import { describe, it, expect } from 'vitest';
import {
  StepId,
  StepStatus,
  STEP_ORDER,
  canAdvance,
  createInitialWizardState,
  type WizardState,
} from './WizardStep';

describe('WizardStep', () => {
  describe('STEP_ORDER', () => {
    it('contains all 7 steps in correct order', () => {
      expect(STEP_ORDER).toHaveLength(7);
      expect(STEP_ORDER[0]).toBe(StepId.CONTEXT_COLLECTION);
      expect(STEP_ORDER[6]).toBe(StepId.FINAL_REVIEW);
    });
  });

  describe('createInitialWizardState', () => {
    it('creates state with all steps NOT_STARTED', () => {
      const state = createInitialWizardState('proj-1');
      expect(state.projectId).toBe('proj-1');
      expect(state.currentStep).toBe(StepId.CONTEXT_COLLECTION);
      for (const step of STEP_ORDER) {
        expect(state.steps[step]).toBe(StepStatus.NOT_STARTED);
      }
    });

    it('sets createdAt and updatedAt to ISO strings', () => {
      const before = new Date().toISOString();
      const state = createInitialWizardState('proj-2');
      const after = new Date().toISOString();
      expect(state.createdAt >= before).toBe(true);
      expect(state.updatedAt <= after).toBe(true);
    });
  });

  describe('canAdvance', () => {
    function makeState(currentStep: StepId, stepStatuses: Partial<Record<StepId, StepStatus>> = {}): WizardState {
      const steps = {} as Record<StepId, StepStatus>;
      for (const s of STEP_ORDER) {
        steps[s] = stepStatuses[s] ?? StepStatus.NOT_STARTED;
      }
      return { projectId: 'test', currentStep, steps, createdAt: '', updatedAt: '' };
    }

    it('allows moving backward', () => {
      const state = makeState(StepId.AZURE_ARCHITECTURE);
      expect(canAdvance(state, StepId.CONTEXT_COLLECTION)).toBe(true);
    });

    it('allows staying on the same step', () => {
      const state = makeState(StepId.RESEARCH_PLAN);
      expect(canAdvance(state, StepId.RESEARCH_PLAN)).toBe(true);
    });

    it('allows advancing to next step when current is completed', () => {
      const state = makeState(StepId.CONTEXT_COLLECTION, {
        [StepId.CONTEXT_COLLECTION]: StepStatus.COMPLETED,
      });
      expect(canAdvance(state, StepId.RESEARCH_PLAN)).toBe(true);
    });

    it('blocks advancing when current step is not completed', () => {
      const state = makeState(StepId.CONTEXT_COLLECTION, {
        [StepId.CONTEXT_COLLECTION]: StepStatus.IN_PROGRESS,
      });
      expect(canAdvance(state, StepId.RESEARCH_PLAN)).toBe(false);
    });

    it('blocks skipping steps', () => {
      const state = makeState(StepId.CONTEXT_COLLECTION, {
        [StepId.CONTEXT_COLLECTION]: StepStatus.COMPLETED,
      });
      expect(canAdvance(state, StepId.AZURE_ARCHITECTURE)).toBe(false);
    });

    it('blocks skipping multiple steps even if current is completed', () => {
      const state = makeState(StepId.CONTEXT_COLLECTION, {
        [StepId.CONTEXT_COLLECTION]: StepStatus.COMPLETED,
      });
      expect(canAdvance(state, StepId.PROPOSAL)).toBe(false);
    });
  });
});
