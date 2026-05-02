export enum StepId {
  CONTEXT_COLLECTION = 'context-collection',
  RESEARCH_PLAN = 'research-plan',
  AZURE_ARCHITECTURE = 'azure-architecture',
  COST_ESTIMATE = 'cost-estimate',
  PROPOSAL = 'proposal',
  PROPOSAL_REVIEW = 'proposal-review',
  FINAL_REVIEW = 'final-review',
}

export enum StepStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export interface WizardState {
  readonly projectId: string;
  readonly currentStep: StepId;
  readonly steps: Record<StepId, StepStatus>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const STEP_ORDER: readonly StepId[] = [
  StepId.CONTEXT_COLLECTION,
  StepId.RESEARCH_PLAN,
  StepId.AZURE_ARCHITECTURE,
  StepId.COST_ESTIMATE,
  StepId.PROPOSAL,
  StepId.PROPOSAL_REVIEW,
  StepId.FINAL_REVIEW,
] as const;

export function canAdvance(state: WizardState, targetStep: StepId): boolean {
  const currentIndex = STEP_ORDER.indexOf(state.currentStep);
  const targetIndex = STEP_ORDER.indexOf(targetStep);
  if (targetIndex <= currentIndex) return true;
  if (targetIndex !== currentIndex + 1) return false;
  return state.steps[state.currentStep] === StepStatus.COMPLETED;
}

export function createInitialWizardState(projectId: string): WizardState {
  const now = new Date().toISOString();
  const steps = {} as Record<StepId, StepStatus>;
  for (const step of STEP_ORDER) {
    steps[step] = StepStatus.NOT_STARTED;
  }
  return { projectId, currentStep: StepId.CONTEXT_COLLECTION, steps, createdAt: now, updatedAt: now };
}
