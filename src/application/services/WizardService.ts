import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import { type WizardState, StepId, StepStatus, STEP_ORDER, canAdvance } from '@/domain/models/WizardStep';
import { reconcileWizardState } from '@/domain/models/Project';

export class WizardService {
  constructor(private readonly projectRepo: IProjectRepository) {}

  async getState(projectId: string): Promise<WizardState> {
    const project = await this.projectRepo.get(projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found`);
    }

    const deliverables = await this.projectRepo.listDeliverables(projectId);
    return reconcileWizardState(project.wizardState, deliverables);
  }

  async completeStep(projectId: string, stepId: StepId): Promise<WizardState> {
    const state = await this.getState(projectId);
    const updated: WizardState = {
      ...state,
      steps: { ...state.steps, [stepId]: StepStatus.COMPLETED },
      updatedAt: new Date().toISOString(),
    };

    await this.projectRepo.updateWizardState(projectId, updated);
    return updated;
  }

  async advanceStep(projectId: string, currentStepId: StepId): Promise<WizardState> {
    const state = await this.getState(projectId);
    const currentIndex = STEP_ORDER.indexOf(currentStepId);

    if (currentIndex === STEP_ORDER.length - 1) {
      throw new Error('Already at the last step');
    }

    const nextStep = STEP_ORDER[currentIndex + 1];

    if (!canAdvance(state, nextStep)) {
      throw new Error(
        `Cannot advance: step "${currentStepId}" is not completed`,
      );
    }

    const updated: WizardState = {
      ...state,
      currentStep: nextStep,
      updatedAt: new Date().toISOString(),
    };

    await this.projectRepo.updateWizardState(projectId, updated);
    return updated;
  }

  async goBackStep(projectId: string, currentStepId: StepId): Promise<WizardState> {
    const state = await this.getState(projectId);
    const currentIndex = STEP_ORDER.indexOf(currentStepId);

    if (currentIndex === 0) {
      throw new Error('Already at the first step');
    }

    const prevStep = STEP_ORDER[currentIndex - 1];
    const updated: WizardState = {
      ...state,
      currentStep: prevStep,
      updatedAt: new Date().toISOString(),
    };

    await this.projectRepo.updateWizardState(projectId, updated);
    return updated;
  }
}
