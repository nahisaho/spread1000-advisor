'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChatStepController } from '@/components/chat/ChatStepController';
import { useProject } from '@/hooks/useProject';
import { LoadingSpinner } from '@/components/common';
import { StepId, STEP_ORDER, StepStatus } from '@/domain/models/WizardStep';
import type { WizardState } from '@/domain/models/WizardStep';

const STEP_LABELS: Record<StepId, string> = {
  [StepId.CONTEXT_COLLECTION]: 'コンテキスト',
  [StepId.RESEARCH_PLAN]: '研究プラン',
  [StepId.AZURE_ARCHITECTURE]: 'Azure構成',
  [StepId.COST_ESTIMATE]: 'コスト',
  [StepId.PROPOSAL]: '申請書',
  [StepId.PROPOSAL_REVIEW]: 'レビュー',
  [StepId.FINAL_REVIEW]: '最終確認',
};

interface ChatLayoutProps {
  projectId: string;
}

export function ChatLayout({ projectId }: ChatLayoutProps) {
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

  return (
    <ChatLayoutInner
      project={project}
      onStateChange={handleStateChange}
    />
  );
}

function ChatLayoutInner({
  project,
  onStateChange,
}: {
  project: NonNullable<ReturnType<typeof useProject>['project']>;
  onStateChange: (state: Partial<WizardState>) => void;
}) {
  const [currentStep, setCurrentStep] = useState<StepId>(project.wizardState.currentStep);
  const [steps, setSteps] = useState<Record<StepId, StepStatus>>({ ...project.wizardState.steps });

  const handleStepComplete = useCallback((stepId: StepId) => {
    const updated = { ...steps, [stepId]: StepStatus.COMPLETED };
    setSteps(updated);
    onStateChange({ currentStep: stepId, steps: updated });
  }, [steps, onStateChange]);

  const handleStepChange = useCallback((stepId: StepId) => {
    setCurrentStep(stepId);
    onStateChange({ currentStep: stepId, steps });
  }, [steps, onStateChange]);

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-4xl mx-auto" data-testid="chat-layout">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-sm font-bold text-gray-900 truncate">{project.name}</h1>
        </div>
      </div>

      {/* Step progress bar */}
      <div className="flex items-center gap-0 px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0 overflow-x-auto" data-testid="step-progress">
        {STEP_ORDER.map((stepId, idx) => {
          const isCompleted = steps[stepId] === StepStatus.COMPLETED;
          const isCurrent = stepId === currentStep;
          return (
            <div key={stepId} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium ${
                    isCompleted ? 'bg-green-600 text-white' :
                    isCurrent ? 'bg-blue-600 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <span className={`mt-0.5 text-[10px] whitespace-nowrap ${
                  isCurrent ? 'font-semibold text-blue-600' : 'text-gray-400'
                }`}>
                  {STEP_LABELS[stepId]}
                </span>
              </div>
              {idx < STEP_ORDER.length - 1 && (
                <div className={`mx-1 h-0.5 w-4 ${isCompleted ? 'bg-green-600' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        <ChatStepController
          projectId={project.id}
          wizardState={{ ...project.wizardState, currentStep, steps }}
          onStepComplete={handleStepComplete}
          onStepChange={handleStepChange}
        />
      </div>
    </div>
  );
}
