import type { ProjectMeta, DeliverableName } from '../interfaces/IProjectRepository';
import type { WizardState } from './WizardStep';
import { StepId, StepStatus } from './WizardStep';

export interface ProjectState {
  readonly meta: ProjectMeta;
  readonly deliverables: Map<DeliverableName, string>;
}

const STEP_DELIVERABLE_MAP: ReadonlyMap<StepId, DeliverableName> = new Map([
  [StepId.CONTEXT_COLLECTION, 'meta-prompt.md'],
  [StepId.RESEARCH_PLAN, 'phase0-research-plan.md'],
  [StepId.AZURE_ARCHITECTURE, 'phase1-azure-architecture.md'],
  [StepId.COST_ESTIMATE, 'phase2-cost-estimate.md'],
  [StepId.PROPOSAL, 'phase3-proposal.md'],
  [StepId.PROPOSAL_REVIEW, 'review-report.md'],
  [StepId.FINAL_REVIEW, 'final-review-report.md'],
]);

export { STEP_DELIVERABLE_MAP };

/** Hydrate project from stored meta + deliverables */
export function hydrateProject(
  meta: ProjectMeta,
  deliverables: Map<DeliverableName, string>,
): ProjectState {
  return { meta, deliverables };
}

/** Reconcile wizard state based on which deliverables actually exist */
export function reconcileWizardState(
  wizardState: WizardState,
  availableDeliverables: DeliverableName[],
): WizardState {
  const deliverableSet = new Set(availableDeliverables);
  const steps = { ...wizardState.steps };

  for (const [stepId, deliverableName] of STEP_DELIVERABLE_MAP) {
    const hasDeliverable = deliverableSet.has(deliverableName);
    const currentStatus = steps[stepId];

    if (hasDeliverable && currentStatus !== StepStatus.COMPLETED) {
      steps[stepId] = StepStatus.COMPLETED;
    } else if (!hasDeliverable && currentStatus === StepStatus.COMPLETED) {
      steps[stepId] = StepStatus.NOT_STARTED;
    }
  }

  return {
    ...wizardState,
    steps,
    updatedAt: new Date().toISOString(),
  };
}
