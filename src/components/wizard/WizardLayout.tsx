'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { StepIndicator } from './StepIndicator';
import { ContextCollectorStep } from './ContextCollectorStep';
import { ResearchPlanStep } from './ResearchPlanStep';
import { AzureArchitectStep } from './AzureArchitectStep';
import { CostEstimateStep } from './CostEstimateStep';
import { ProposalStep } from './ProposalStep';
import { ProposalReviewStep } from './ProposalReviewStep';
import { FinalReviewStep } from './FinalReviewStep';
import { useWizardStep } from '@/hooks/useWizardStep';
import { useProject } from '@/hooks/useProject';
import { LoadingSpinner } from '@/components/common';
import { StepId, type WizardState } from '@/domain/models/WizardStep';

interface WizardLayoutProps {
  projectId: string;
}

export function WizardLayout({ projectId }: WizardLayoutProps) {
  const t = useTranslations();
  const { project, isLoading, error } = useProject(projectId);

  const handleStateChange = useCallback(
    async (state: Partial<WizardState>) => {
      await fetch(`/api/projects/${encodeURIComponent(projectId)}/wizard-state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
    },
    [projectId],
  );

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner label={t('common.loading')} />
      </div>
    );
  }

  return <WizardLayoutInner project={project} onStateChange={handleStateChange} />;
}

function renderStepComponent(stepId: string, projectId: string, onComplete: () => void) {
  switch (stepId) {
    case StepId.CONTEXT_COLLECTION:
      return <ContextCollectorStep projectId={projectId} onComplete={onComplete} />;
    case StepId.RESEARCH_PLAN:
      return <ResearchPlanStep projectId={projectId} onComplete={onComplete} />;
    case StepId.AZURE_ARCHITECTURE:
      return <AzureArchitectStep projectId={projectId} onComplete={onComplete} />;
    case StepId.COST_ESTIMATE:
      return <CostEstimateStep projectId={projectId} onComplete={onComplete} />;
    case StepId.PROPOSAL:
      return <ProposalStep projectId={projectId} onComplete={onComplete} />;
    case StepId.PROPOSAL_REVIEW:
      return <ProposalReviewStep projectId={projectId} onComplete={onComplete} />;
    case StepId.FINAL_REVIEW:
      return <FinalReviewStep projectId={projectId} />;
    default:
      return <p className="text-gray-500">Unknown step</p>;
  }
}

function WizardLayoutInner({
  project,
  onStateChange,
}: {
  project: NonNullable<ReturnType<typeof useProject>['project']>;
  onStateChange: (state: Partial<WizardState>) => void;
}) {
  const t = useTranslations();
  const { currentStep, steps, goNext, goBack, canGoNext, canGoBack } = useWizardStep(
    project.wizardState,
    onStateChange,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6" data-testid="wizard-layout">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">{project.name}</h1>
      </div>

      <StepIndicator currentStep={currentStep} steps={steps} />

      <div
        className="min-h-[300px] rounded-lg border border-gray-200 bg-white p-6"
        data-testid="step-content"
      >
        {renderStepComponent(currentStep, project.id, goNext)}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={!canGoBack}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="wizard-back"
        >
          {t('wizard.actions.back')}
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="wizard-next"
        >
          {t('wizard.actions.next')}
        </button>
      </div>
    </div>
  );
}
