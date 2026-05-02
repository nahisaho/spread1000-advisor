import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ProjectMeta } from '@/domain/interfaces/IProjectRepository';
import { StepId, StepStatus, createInitialWizardState } from '@/domain/models/WizardStep';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'app.title': 'SPReAD-1000 Advisor',
      'app.description': 'AI-powered application support',
      'nav.newProject': 'New Project',
      'common.loading': 'Loading...',
      'common.saving': 'Saving...',
      'wizard.actions.save': 'Save',
      'wizard.actions.regenerate': 'Retry',
      'wizard.status.notStarted': 'Not Started',
      'wizard.status.inProgress': 'In Progress',
      'wizard.status.completed': 'Completed',
    };
    return translations[key] ?? key;
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { ProjectSelector } from './ProjectSelector';

function createMockProject(overrides: Partial<ProjectMeta> = {}): ProjectMeta {
  const id = overrides.id ?? 'test-id-1';
  return {
    id,
    name: 'test-project',
    wizardState: createInitialWizardState(id),
    llmProvider: 'openai',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProjectSelector', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('shows loading state initially', () => {
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {}));
    render(<ProjectSelector />);
    expect(screen.getByTestId('project-loading')).toBeDefined();
  });

  it('renders empty state when no projects', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    render(<ProjectSelector />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeDefined();
    });
  });

  it('renders project list', async () => {
    const projects = [
      createMockProject({ id: 'p1', name: 'project-alpha' }),
      createMockProject({ id: 'p2', name: 'project-beta' }),
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(projects), { status: 200 }),
    );

    render(<ProjectSelector />);

    await waitFor(() => {
      expect(screen.getByTestId('project-list')).toBeDefined();
      expect(screen.getByText('project-alpha')).toBeDefined();
      expect(screen.getByText('project-beta')).toBeDefined();
    });
  });

  it('shows create form when button clicked', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    render(<ProjectSelector />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeDefined();
    });

    // Click new project button (there are two - header and empty state)
    const buttons = screen.getAllByText('New Project');
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('create-project-form')).toBeDefined();
    });
  });

  it('validates project name', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    render(<ProjectSelector />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeDefined();
    });

    const buttons = screen.getAllByText('New Project');
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('create-project-form')).toBeDefined();
    });

    const input = screen.getByPlaceholderText('my-project');
    fireEvent.change(input, { target: { value: '../bad-name' } });

    await waitFor(() => {
      expect(screen.getByTestId('name-error')).toBeDefined();
    });
  });

  it('shows error state on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Server Error', { status: 500 }),
    );

    render(<ProjectSelector />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('shows project status label', async () => {
    const project = createMockProject({ name: 'status-project' });
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([project]), { status: 200 }),
    );

    render(<ProjectSelector />);

    await waitFor(() => {
      expect(screen.getByText('Not Started')).toBeDefined();
    });
  });
});
