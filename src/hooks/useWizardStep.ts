'use client';

import { useCallback, useState } from 'react';
import { StepId, StepStatus, STEP_ORDER, canAdvance } from '@/domain/models/WizardStep';
import type { WizardState } from '@/domain/models/WizardStep';

export interface UseWizardStepReturn {
  currentStep: StepId;
  steps: Record<StepId, StepStatus>;
  goNext: () => void;
  goBack: () => void;
  completeCurrentStep: () => void;
  canGoNext: boolean;
  canGoBack: boolean;
}

export function useWizardStep(
  wizardState: WizardState,
  onStateChange?: (state: Partial<WizardState>) => void,
): UseWizardStepReturn {
  const [currentStep, setCurrentStep] = useState<StepId>(wizardState.currentStep);
  const [steps, setSteps] = useState<Record<StepId, StepStatus>>({ ...wizardState.steps });

  const currentIndex = STEP_ORDER.indexOf(currentStep);

  const canGoBack = currentIndex > 0;
  const canGoNext = currentIndex < STEP_ORDER.length - 1 && steps[currentStep] === StepStatus.COMPLETED;

  const goNext = useCallback(() => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx < STEP_ORDER.length - 1) {
      const nextStep = STEP_ORDER[idx + 1];
      const state: WizardState = {
        ...wizardState,
        currentStep: nextStep,
        steps,
        updatedAt: new Date().toISOString(),
      };
      if (canAdvance(state, nextStep)) {
        setCurrentStep(nextStep);
        onStateChange?.({ currentStep: nextStep, steps });
      }
    }
  }, [currentStep, steps, wizardState, onStateChange]);

  const goBack = useCallback(() => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) {
      const prevStep = STEP_ORDER[idx - 1];
      setCurrentStep(prevStep);
      onStateChange?.({ currentStep: prevStep, steps });
    }
  }, [currentStep, steps, onStateChange]);

  const completeCurrentStep = useCallback(() => {
    const updated = { ...steps, [currentStep]: StepStatus.COMPLETED };
    setSteps(updated);
    onStateChange?.({ currentStep, steps: updated });
  }, [currentStep, steps, onStateChange]);

  return { currentStep, steps, goNext, goBack, completeCurrentStep, canGoNext, canGoBack };
}
