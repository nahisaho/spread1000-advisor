import { describe, it, expect } from 'vitest';
import { hydrateProject, reconcileWizardState, STEP_DELIVERABLE_MAP } from './Project';
import { StepId, StepStatus, createInitialWizardState } from './WizardStep';
import type { ProjectMeta, DeliverableName } from '../interfaces/IProjectRepository';
import type { WizardState } from './WizardStep';

function makeMeta(overrides: Partial<ProjectMeta> = {}): ProjectMeta {
  const wizardState = createInitialWizardState('test-project');
  return {
    id: 'test-project',
    name: 'Test Project',
    wizardState,
    llmProvider: 'openai',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeWizardState(
  stepStatuses: Partial<Record<StepId, StepStatus>> = {},
): WizardState {
  const base = createInitialWizardState('test-project');
  const steps = { ...base.steps };
  for (const [id, status] of Object.entries(stepStatuses)) {
    steps[id as StepId] = status;
  }
  return { ...base, steps };
}

describe('Project', () => {
  describe('hydrateProject', () => {
    it('creates ProjectState from meta and deliverables', () => {
      const meta = makeMeta();
      const deliverables = new Map<DeliverableName, string>([
        ['meta-prompt.md', '# Meta Prompt'],
      ]);
      const state = hydrateProject(meta, deliverables);

      expect(state.meta).toBe(meta);
      expect(state.deliverables).toBe(deliverables);
      expect(state.deliverables.get('meta-prompt.md')).toBe('# Meta Prompt');
    });

    it('works with empty deliverables', () => {
      const meta = makeMeta();
      const deliverables = new Map<DeliverableName, string>();
      const state = hydrateProject(meta, deliverables);

      expect(state.meta).toBe(meta);
      expect(state.deliverables.size).toBe(0);
    });
  });

  describe('reconcileWizardState', () => {
    it('marks step completed when deliverable exists but step is not completed', () => {
      const wizard = makeWizardState({
        [StepId.CONTEXT_COLLECTION]: StepStatus.NOT_STARTED,
      });
      const result = reconcileWizardState(wizard, ['meta-prompt.md']);

      expect(result.steps[StepId.CONTEXT_COLLECTION]).toBe(StepStatus.COMPLETED);
    });

    it('marks step completed when deliverable exists and step is in_progress', () => {
      const wizard = makeWizardState({
        [StepId.RESEARCH_PLAN]: StepStatus.IN_PROGRESS,
      });
      const result = reconcileWizardState(wizard, ['phase0-research-plan.md']);

      expect(result.steps[StepId.RESEARCH_PLAN]).toBe(StepStatus.COMPLETED);
    });

    it('resets step to not_started when completed but deliverable missing', () => {
      const wizard = makeWizardState({
        [StepId.CONTEXT_COLLECTION]: StepStatus.COMPLETED,
      });
      const result = reconcileWizardState(wizard, []);

      expect(result.steps[StepId.CONTEXT_COLLECTION]).toBe(StepStatus.NOT_STARTED);
    });

    it('does not change step that is already completed with deliverable present', () => {
      const wizard = makeWizardState({
        [StepId.CONTEXT_COLLECTION]: StepStatus.COMPLETED,
      });
      const result = reconcileWizardState(wizard, ['meta-prompt.md']);

      expect(result.steps[StepId.CONTEXT_COLLECTION]).toBe(StepStatus.COMPLETED);
    });

    it('does not change not_started step without deliverable', () => {
      const wizard = makeWizardState();
      const result = reconcileWizardState(wizard, []);

      expect(result.steps[StepId.CONTEXT_COLLECTION]).toBe(StepStatus.NOT_STARTED);
    });

    it('reconciles multiple steps simultaneously', () => {
      const wizard = makeWizardState({
        [StepId.CONTEXT_COLLECTION]: StepStatus.NOT_STARTED,
        [StepId.RESEARCH_PLAN]: StepStatus.COMPLETED,
        [StepId.AZURE_ARCHITECTURE]: StepStatus.IN_PROGRESS,
      });
      const result = reconcileWizardState(wizard, [
        'meta-prompt.md',
        'phase1-azure-architecture.md',
      ]);

      expect(result.steps[StepId.CONTEXT_COLLECTION]).toBe(StepStatus.COMPLETED);
      expect(result.steps[StepId.RESEARCH_PLAN]).toBe(StepStatus.NOT_STARTED);
      expect(result.steps[StepId.AZURE_ARCHITECTURE]).toBe(StepStatus.COMPLETED);
    });

    it('updates the updatedAt timestamp', () => {
      const wizard = makeWizardState();
      const before = new Date().toISOString();
      const result = reconcileWizardState(wizard, []);
      const after = new Date().toISOString();

      expect(result.updatedAt >= before).toBe(true);
      expect(result.updatedAt <= after).toBe(true);
    });

    it('preserves projectId and currentStep', () => {
      const wizard = makeWizardState();
      const result = reconcileWizardState(wizard, []);

      expect(result.projectId).toBe(wizard.projectId);
      expect(result.currentStep).toBe(wizard.currentStep);
    });

    it('covers all step-deliverable mappings', () => {
      expect(STEP_DELIVERABLE_MAP.size).toBe(7);
      expect(STEP_DELIVERABLE_MAP.get(StepId.CONTEXT_COLLECTION)).toBe('meta-prompt.md');
      expect(STEP_DELIVERABLE_MAP.get(StepId.RESEARCH_PLAN)).toBe('phase0-research-plan.md');
      expect(STEP_DELIVERABLE_MAP.get(StepId.AZURE_ARCHITECTURE)).toBe('phase1-azure-architecture.md');
      expect(STEP_DELIVERABLE_MAP.get(StepId.COST_ESTIMATE)).toBe('phase2-cost-estimate.md');
      expect(STEP_DELIVERABLE_MAP.get(StepId.PROPOSAL)).toBe('phase3-proposal.md');
      expect(STEP_DELIVERABLE_MAP.get(StepId.PROPOSAL_REVIEW)).toBe('review-report.md');
      expect(STEP_DELIVERABLE_MAP.get(StepId.FINAL_REVIEW)).toBe('final-review-report.md');
    });
  });
});
