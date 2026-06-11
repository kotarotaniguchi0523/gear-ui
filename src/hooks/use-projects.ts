import { useEffect, useReducer, useTransition } from "hono/jsx";
import type { DesignRules } from "@/lib/schemas";
import { apiClient } from "@/lib/api-client";
// Single source of truth for these shapes lives next to the DB repo. These are
// `import type` only, so no server/better-sqlite3 code reaches the client bundle.
import type { Project, ProjectSummary } from "@/lib/repo/projects";

export type { Project, ProjectSummary };

type ProjectPatch = {
  name?: string;
  requirement?: string;
  designRules?: DesignRules | null;
};

type PatchProject = (args: {
  param: { id: string };
  json: ProjectPatch;
}) => Promise<Response>;

type ProjectsState = {
  list: ProjectSummary[];
  loading: boolean;
  error: string | null;
};

type ProjectsAction =
  | { type: "loading" }
  | { type: "loaded"; list: ProjectSummary[] }
  | { type: "failed"; error: string }
  | { type: "optimisticRename"; id: string; name: string }
  | { type: "optimisticDelete"; id: string }
  | { type: "reconcile"; project: Project };

const initialState: ProjectsState = {
  list: [],
  loading: true,
  error: null,
};

type ProjectsHandler<K extends ProjectsAction["type"]> = (
  state: ProjectsState,
  action: Extract<ProjectsAction, { type: K }>
) => ProjectsState;

const projectHandlers: {
  [K in ProjectsAction["type"]]: ProjectsHandler<K>;
} = {
  loading: (state) => ({ ...state, loading: true, error: null }),
  loaded: (_state, action) => ({
    list: action.list,
    loading: false,
    error: null,
  }),
  failed: (state, action) => ({
    ...state,
    loading: false,
    error: action.error,
  }),
  optimisticRename: (state, action) => ({
    ...state,
    list: state.list.map((p) =>
      p.id === action.id ? { ...p, name: action.name, updatedAt: Date.now() } : p
    ),
  }),
  optimisticDelete: (state, action) => ({
    ...state,
    list: state.list.filter((p) => p.id !== action.id),
  }),
  reconcile: (state, action) => ({
    ...state,
    list: state.list.map((p) =>
      p.id === action.project.id
        ? {
            ...p,
            name: action.project.name,
            updatedAt: action.project.updatedAt,
            hasDefinitions: !!action.project.definitions,
            screenCount: action.project.definitions?.screens.length ?? 0,
          }
        : p
    ),
  }),
};

function projectsReducer(
  state: ProjectsState,
  action: ProjectsAction
): ProjectsState {
  const handler = projectHandlers[action.type] as (
    state: ProjectsState,
    action: ProjectsAction
  ) => ProjectsState;
  return handler(state, action);
}

async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await apiClient.api.projects.$get();
  const data = await res.json();
  return data.projects ?? [];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function useProjects() {
  const [state, dispatch] = useReducer(projectsReducer, initialState);
  const [pending, startTransition] = useTransition();

  async function reload() {
    dispatch({ type: "loading" });
    try {
      dispatch({ type: "loaded", list: await fetchProjects() });
    } catch (error) {
      dispatch({ type: "failed", error: messageOf(error) });
    }
  }

  useEffect(() => {
    let active = true;
    fetchProjects()
      .then((projects) => {
        if (active) dispatch({ type: "loaded", list: projects });
      })
      .catch((error) => {
        if (active) dispatch({ type: "failed", error: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, []);

  async function create(input: {
    name?: string;
    requirement?: string;
    designRules?: DesignRules;
  }) {
    const res = await apiClient.api.projects.$post({ json: input });
    const project = (await res.json()) as Project;
    startTransition(() => reload());
    return project;
  }

  async function load(id: string): Promise<Project | null> {
    const res = await apiClient.api.projects[":id"].$get({ param: { id } });
    if (!res.ok) return null;
    return (await res.json()) as Project;
  }

  async function patch(id: string, data: ProjectPatch): Promise<Project | null> {
    if (data.name) dispatch({ type: "optimisticRename", id, name: data.name });
    const patchProject = apiClient.api.projects[":id"].$patch as unknown as PatchProject;
    const res = await patchProject({
      param: { id },
      json: data,
    });
    if (!res.ok) {
      startTransition(() => reload());
      return null;
    }
    const project = (await res.json()) as Project;
    dispatch({ type: "reconcile", project });
    return project;
  }

  async function remove(id: string) {
    dispatch({ type: "optimisticDelete", id });
    const res = await apiClient.api.projects[":id"].$delete({ param: { id } });
    if (!res.ok) {
      startTransition(() => reload());
      return;
    }
    startTransition(() => reload());
  }

  return {
    list: state.list,
    loading: state.loading || pending,
    error: state.error,
    reload,
    create,
    load,
    patch,
    remove,
  };
}
