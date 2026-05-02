import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepId, StepStatus, STEP_ORDER } from '@/domain/models/WizardStep';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
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

import { StepIndicator } from './StepIndicator';

function createSteps(overrides: Partial<Record<StepId, StepStatus>> = {}): Record<StepId, StepStatus> {
  const steps = {} as Record<StepId, StepStatus>;
  for (const step of STEP_ORDER) {
    steps[step] = StepStatus.NOT_STARTED;
  }
  return { ...steps, ...overrides };
}

describe('StepIndicator', () => {
  it('renders all 7 steps', () => {
    const steps = createSteps();
    render(<StepIndicator currentStep={StepId.CONTEXT_COLLECTION} steps={steps} />);

    expect(screen.getByTestId('step-indicator')).toBeDefined();
    for (const stepId of STEP_ORDER) {
      expect(screen.getByTestId(`step-${stepId}`)).toBeDefined();
    }
  });

  it('highlights current step', () => {
    const steps = createSteps();
    render(<StepIndicator currentStep={StepId.RESEARCH_PLAN} steps={steps} />);

    const currentStepEl = screen.getByTestId('step-research-plan');
    const indicator = currentStepEl.querySelector('[aria-current="step"]');
    expect(indicator).toBeDefined();
    expect(indicator?.textContent).toBe('2');
  });

  it('shows checkmark for completed steps', () => {
    const steps = createSteps({
      [StepId.CONTEXT_COLLECTION]: StepStatus.COMPLETED,
    });
    render(<StepIndicator currentStep={StepId.RESEARCH_PLAN} steps={steps} />);

    const completedStep = screen.getByTestId('step-context-collection');
    expect(completedStep.textContent).toContain('✓');
  });

  it('shows step numbers for non-completed steps', () => {
    const steps = createSteps();
    render(<StepIndicator currentStep={StepId.CONTEXT_COLLECTION} steps={steps} />);

    const step3 = screen.getByTestId('step-azure-architecture');
    expect(step3.textContent).toContain('3');
  });

  it('displays step labels from i18n', () => {
    const steps = createSteps();
    render(<StepIndicator currentStep={StepId.CONTEXT_COLLECTION} steps={steps} />);

    expect(screen.getAllByText('Context Collection').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Research Plan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cost Estimate').length).toBeGreaterThan(0);
  });

  it('renders mobile layout', () => {
    const steps = createSteps();
    render(<StepIndicator currentStep={StepId.CONTEXT_COLLECTION} steps={steps} />);

    for (const stepId of STEP_ORDER) {
      expect(screen.getByTestId(`step-mobile-${stepId}`)).toBeDefined();
    }
  });
});
