import { useCallback, useEffect, useState } from "hono/jsx";
import type { DesignRules } from "@/lib/schemas";
import { apiClient } from "@/lib/api-client";
// Single source of truth for these shapes lives next to the DB repo. These are
// `import type` only, so no server/better-sqlite3 code reaches the client bundle.
import type { Project, ProjectSummary } from "@/lib/repo/projects";

export type { Project, ProjectSummary };

async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await apiClient.api.projects.$get();
  const data = await res.json();
  return data.projects ?? [];
}

export function useProjects() {
  const [list, setList] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setList(await fetchProjects());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchProjects()
      .then((projects) => {
        if (active) setList(projects);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const create = useCallback(
    async (input: {
      name?: string;
      requirement?: string;
      designRules?: DesignRules;
    }) => {
      const res = await apiClient.api.projects.$post({ json: input });
      const project = (await res.json()) as Project;
      await reload();
      return project;
    },
    [reload]
  );

  const load = useCallback(async (id: string): Promise<Project | null> => {
    const res = await apiClient.api.projects[":id"].$get({ param: { id } });
    if (!res.ok) return null;
    return (await res.json()) as Project;
  }, []);

  const patch = useCallback(
    async (
      id: string,
      data: {
        name?: string;
        requirement?: string;
        designRules?: DesignRules | null;
      }
    ): Promise<Project | null> => {
      const res = await (apiClient.api.projects[":id"].$patch as any)({
        param: { id },
        json: data,
      });
      if (!res.ok) return null;
      const project = (await res.json()) as Project;
      // Update the list entry locally without a full reload
      setList((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, name: project.name, updatedAt: project.updatedAt }
            : p
        )
      );
      return project;
    },
    []
  );

  const remove = useCallback(
    async (id: string) => {
      await apiClient.api.projects[":id"].$delete({ param: { id } });
      await reload();
    },
    [reload]
  );

  return { list, loading, reload, create, load, patch, remove };
}
