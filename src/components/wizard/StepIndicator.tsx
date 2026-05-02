'use client';

import { useTranslations } from 'next-intl';
import { StepId, StepStatus, STEP_ORDER } from '@/domain/models/WizardStep';

const STEP_I18N_KEYS: Record<StepId, string> = {
  [StepId.CONTEXT_COLLECTION]: 'wizard.steps.contextCollection',
  [StepId.RESEARCH_PLAN]: 'wizard.steps.researchPlan',
  [StepId.AZURE_ARCHITECTURE]: 'wizard.steps.azureArchitecture',
  [StepId.COST_ESTIMATE]: 'wizard.steps.costEstimate',
  [StepId.PROPOSAL]: 'wizard.steps.proposal',
  [StepId.PROPOSAL_REVIEW]: 'wizard.steps.proposalReview',
  [StepId.FINAL_REVIEW]: 'wizard.steps.finalReview',
};

interface StepIndicatorProps {
  currentStep: StepId;
  steps: Record<StepId, StepStatus>;
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  const t = useTranslations();

  return (
    <nav aria-label="Wizard steps" data-testid="step-indicator">
      {/* Horizontal on desktop */}
      <ol className="hidden sm:flex sm:items-center sm:gap-0">
        {STEP_ORDER.map((stepId, index) => {
          const status = steps[stepId];
          const isCurrent = stepId === currentStep;
          const isCompleted = status === StepStatus.COMPLETED;

          return (
            <li key={stepId} className="flex items-center" data-testid={`step-${stepId}`}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    isCompleted
                      ? 'bg-green-600 text-white'
                      : isCurrent
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span
                  className={`mt-1 text-xs whitespace-nowrap ${
                    isCurrent ? 'font-semibold text-blue-600' : 'text-gray-500'
                  }`}
                >
                  {t(STEP_I18N_KEYS[stepId])}
                </span>
              </div>
              {index < STEP_ORDER.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-8 ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Vertical on mobile */}
      <ol className="flex flex-col gap-2 sm:hidden">
        {STEP_ORDER.map((stepId, index) => {
          const status = steps[stepId];
          const isCurrent = stepId === currentStep;
          const isCompleted = status === StepStatus.COMPLETED;

          return (
            <li key={stepId} className="flex items-center gap-3" data-testid={`step-mobile-${stepId}`}>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                  isCompleted
                    ? 'bg-green-600 text-white'
                    : isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <span
                className={`text-sm ${
                  isCurrent ? 'font-semibold text-blue-600' : 'text-gray-500'
                }`}
              >
                {t(STEP_I18N_KEYS[stepId])}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
