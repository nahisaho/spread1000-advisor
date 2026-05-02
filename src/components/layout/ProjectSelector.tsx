'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { validateProjectName } from '@/lib/validation';
import { LoadingSpinner } from '@/components/common';
import type { ProjectMeta } from '@/domain/interfaces/IProjectRepository';
import { StepStatus } from '@/domain/models/WizardStep';
import { STEP_ORDER } from '@/domain/models/WizardStep';

function getProjectProgress(project: ProjectMeta): number {
  const completedSteps = STEP_ORDER.filter(
    (step) => project.wizardState.steps[step] === StepStatus.COMPLETED,
  ).length;
  return Math.round((completedSteps / STEP_ORDER.length) * 100);
}

function getProjectStatusLabel(project: ProjectMeta, t: (key: string) => string): string {
  const completed = STEP_ORDER.filter(
    (step) => project.wizardState.steps[step] === StepStatus.COMPLETED,
  ).length;
  if (completed === 0) return t('wizard.status.notStarted');
  if (completed === STEP_ORDER.length) return t('wizard.status.completed');
  return t('wizard.status.inProgress');
}

export function ProjectSelector() {
  const t = useTranslations();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      const data = (await res.json()) as ProjectMeta[];
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleNameChange = (value: string) => {
    setNewName(value);
    if (value) {
      const result = validateProjectName(value);
      setNameError(result.valid ? null : (result.error ?? null));
    } else {
      setNameError(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    const result = validateProjectName(trimmed);
    if (!result.valid) {
      setNameError(result.error ?? 'Invalid name');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to create' }));
        throw new Error((body as { error?: string }).error ?? 'Failed to create');
      }
      const created = (await res.json()) as ProjectMeta;
      setNewName('');
      setShowForm(false);
      router.push(`/projects/${created.id}`);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12" data-testid="project-loading">
        <LoadingSpinner label={t('common.loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
        <p className="text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => void loadProjects()}
          className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          {t('wizard.actions.regenerate')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900" data-testid="project-list-title">
          {t('app.title')}
        </h2>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          data-testid="new-project-button"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
        >
          {t('nav.newProject')}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          data-testid="create-project-form"
        >
          <label htmlFor="project-name" className="block text-sm font-medium text-gray-700">
            Project Name
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="project-name"
              type="text"
              value={newName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="my-project"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
              disabled={isCreating}
              aria-invalid={nameError ? 'true' : 'false'}
              aria-describedby={nameError ? 'name-error' : undefined}
            />
            <button
              type="submit"
              disabled={isCreating || !!nameError || !newName.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isCreating ? t('common.saving') : t('wizard.actions.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setNewName('');
                setNameError(null);
              }}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          {nameError && (
            <p id="name-error" className="mt-1 text-sm text-red-600" role="alert" data-testid="name-error">
              {nameError}
            </p>
          )}
        </form>
      )}

      {projects.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center" data-testid="empty-state">
          <p className="text-gray-500">{t('app.description')}</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t('nav.newProject')}
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white" data-testid="project-list">
          {projects.map((project) => (
            <li key={project.id}>
              <a
                href={`/projects/${project.id}`}
                className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                data-testid={`project-item-${project.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{project.name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-600">
                      {getProjectStatusLabel(project, t)}
                    </span>
                    <div className="mt-1 h-2 w-24 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-blue-600 transition-all"
                        style={{ width: `${getProjectProgress(project)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
