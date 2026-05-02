'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProjectMeta } from '@/domain/interfaces/IProjectRepository';

export interface UseProjectReturn {
  project: ProjectMeta | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProject(projectId: string | null): UseProjectReturn {
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
      if (!res.ok) {
        const body = await res.text().catch(() => 'Unknown error');
        throw new Error(body);
      }
      const data = (await res.json()) as ProjectMeta;
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      void refresh();
    }
  }, [projectId, refresh]);

  return { project, isLoading, error, refresh };
}
