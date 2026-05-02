import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ProjectMeta } from '@/domain/interfaces/IProjectRepository';
import { createInitialWizardState } from '@/domain/models/WizardStep';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'common.loading': 'Loading...',
      'wizard.actions.next': 'Next',
      'wizard.actions.back': 'Back',
      'wizard.steps.contextCollection': 'Context Collection',
      'wizard.steps.researchPlan': 'Research Plan',
      'wizard.steps.azureArchitecture': 'Azure Architecture',
      'wizard.steps.costEstimate': 'Cost Estimate',
      'wizard.steps.proposal': 'Proposal',
      'wizard.steps.proposalReview': 'Review',
      'wizard.steps.finalReview': 'Final Review',
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

import { WizardLayout } from './WizardLayout';

function createMockProject(): ProjectMeta {
  return {
    id: 'test-project-id',
    name: 'Test Project',
    wizardState: createInitialWizardState('test-project-id'),
    llmProvider: 'openai',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('WizardLayout', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('shows loading state initially', () => {
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {}));
    render(<WizardLayout projectId="test-project-id" />);
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('renders wizard layout after loading', async () => {
    const project = createMockProject();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(project), { status: 200 }),
    );

    render(<WizardLayout projectId="test-project-id" />);

    await vi.waitFor(() => {
      expect(screen.getByTestId('wizard-layout')).toBeDefined();
    });

    expect(screen.getByTestId('step-indicator')).toBeDefined();
    expect(screen.getByTestId('wizard-back')).toBeDefined();
    expect(screen.getByTestId('wizard-next')).toBeDefined();
  });

  it('shows project name', async () => {
    const project = createMockProject();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(project), { status: 200 }),
    );

    render(<WizardLayout projectId="test-project-id" />);

    await vi.waitFor(() => {
      expect(screen.getByText('Test Project')).toBeDefined();
    });
  });

  it('back button is disabled on first step', async () => {
    const project = createMockProject();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(project), { status: 200 }),
    );

    render(<WizardLayout projectId="test-project-id" />);

    await vi.waitFor(() => {
      const backBtn = screen.getByTestId('wizard-back');
      expect(backBtn).toBeDefined();
      expect((backBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('shows error state on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Not found', { status: 404 }),
    );

    render(<WizardLayout projectId="nonexistent" />);

    await vi.waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });
});
