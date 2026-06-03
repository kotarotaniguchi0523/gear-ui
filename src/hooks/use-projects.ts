"use client";

import { useCallback, useEffect, useState } from "react";
import type { DesignRules } from "@/lib/schemas";
// Single source of truth for these shapes lives next to the DB repo. These are
// `import type` only, so no server/better-sqlite3 code reaches the client bundle.
import type { Project, ProjectSummary } from "@/lib/repo/projects";

export type { Project, ProjectSummary };

async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetch("/api/projects");
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
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const project = (await res.json()) as Project;
      await reload();
      return project;
    },
    [reload]
  );

  const load = useCallback(async (id: string): Promise<Project | null> => {
    const res = await fetch(`/api/projects/${id}`);
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
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
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
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      await reload();
    },
    [reload]
  );

  return { list, loading, reload, create, load, patch, remove };
}
