import type { DeliverableName } from '@/domain/interfaces/IProjectRepository';
import { type StepId } from '@/domain/models/WizardStep';
import { STEP_DELIVERABLE_MAP } from '@/domain/models/Project';

export interface StepValidationResult {
  readonly valid: boolean;
  readonly missing: string[];
}

export class ValidationService {
  validateStepCompletion(
    stepId: StepId,
    deliverables: DeliverableName[],
  ): StepValidationResult {
    const requiredDeliverable = STEP_DELIVERABLE_MAP.get(stepId);

    if (!requiredDeliverable) {
      return { valid: true, missing: [] };
    }

    const deliverableSet = new Set(deliverables);
    if (deliverableSet.has(requiredDeliverable)) {
      return { valid: true, missing: [] };
    }

    return { valid: false, missing: [requiredDeliverable] };
  }
}
