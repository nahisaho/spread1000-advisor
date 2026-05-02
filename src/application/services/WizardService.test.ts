import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WizardService } from './WizardService';
import type { IProjectRepository, ProjectMeta, DeliverableName } from '@/domain/interfaces/IProjectRepository';
import { StepId, StepStatus, createInitialWizardState } from '@/domain/models/WizardStep';

function createMockRepo(overrides: Partial<IProjectRepository> = {}): IProjectRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateWizardState: vi.fn().mockResolvedValue(undefined),
    saveDeliverable: vi.fn(),
    loadDeliverable: vi.fn().mockResolvedValue(null),
    listDeliverables: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeProjectMeta(wizardState = createInitialWizardState('proj-1')): ProjectMeta {
  return {
    id: 'proj-1',
    name: 'Test Project',
    wizardState,
    llmProvider: 'openai',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };
}

describe('WizardService', () => {
  let mockRepo: IProjectRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getState', () => {
    it('returns reconciled wizard state', async () => {
      mockRepo = createMockRepo({
        get: vi.fn().mockResolvedValue(makeProjectMeta()),
        listDeliverables: vi.fn().mockResolvedValue(['meta-prompt.md'] as DeliverableName[]),
      });
      const service = new WizardService(mockRepo);

      const state = await service.getState('proj-1');

      expect(state.steps[StepId.CONTEXT_COLLECTION]).toBe(StepStatus.COMPLETED);
      expect(state.steps[StepId.RESEARCH_PLAN]).toBe(StepStatus.NOT_STARTED);
    });

    it('throws when project not found', async () => {
      mockRepo = createMockRepo();
      const service = new WizardService(mockRepo);

      await expect(service.getState('nonexistent')).rejects.toThrow('Project "nonexistent" not found');
    });
  });

  describe('completeStep', () => {
    it('marks step as completed', async () => {
      mockRepo = createMockRepo({
        get: vi.fn().mockResolvedValue(makeProjectMeta()),
        listDeliverables: vi.fn().mockResolvedValue([]),
      });
      const service = new WizardService(mockRepo);

      const state = await service.completeStep('proj-1', StepId.CONTEXT_COLLECTION);

      expect(state.steps[StepId.CONTEXT_COLLECTION]).toBe(StepStatus.COMPLETED);
      expect(mockRepo.updateWizardState).toHaveBeenCalledOnce();
    });
  });

  describe('advanceStep', () => {
    it('advances to next step when current is completed', async () => {
      const initial = createInitialWizardState('proj-1');
      const withCompleted = {
        ...initial,
        steps: { ...initial.steps, [StepId.CONTEXT_COLLECTION]: StepStatus.COMPLETED },
      };
      mockRepo = createMockRepo({
        get: vi.fn().mockResolvedValue(makeProjectMeta(withCompleted)),
        listDeliverables: vi.fn().mockResolvedValue(['meta-prompt.md'] as DeliverableName[]),
      });
      const service = new WizardService(mockRepo);

      const state = await service.advanceStep('proj-1', StepId.CONTEXT_COLLECTION);

      expect(state.currentStep).toBe(StepId.RESEARCH_PLAN);
      expect(mockRepo.updateWizardState).toHaveBeenCalledOnce();
    });

    it('throws when step is not completed', async () => {
      mockRepo = createMockRepo({
        get: vi.fn().mockResolvedValue(makeProjectMeta()),
        listDeliverables: vi.fn().mockResolvedValue([]),
      });
      const service = new WizardService(mockRepo);

      await expect(
        service.advanceStep('proj-1', StepId.CONTEXT_COLLECTION),
      ).rejects.toThrow('Cannot advance');
    });

    it('throws when already at last step', async () => {
      const initial = createInitialWizardState('proj-1');
      const atLast = {
        ...initial,
        currentStep: StepId.FINAL_REVIEW,
        steps: { ...initial.steps, [StepId.FINAL_REVIEW]: StepStatus.COMPLETED },
      };
      mockRepo = createMockRepo({
        get: vi.fn().mockResolvedValue(makeProjectMeta(atLast)),
        listDeliverables: vi.fn().mockResolvedValue([]),
      });
      const service = new WizardService(mockRepo);

      await expect(
        service.advanceStep('proj-1', StepId.FINAL_REVIEW),
      ).rejects.toThrow('Already at the last step');
    });
  });

  describe('goBackStep', () => {
    it('goes back to previous step', async () => {
      const initial = createInitialWizardState('proj-1');
      const atSecond = { ...initial, currentStep: StepId.RESEARCH_PLAN };
      mockRepo = createMockRepo({
        get: vi.fn().mockResolvedValue(makeProjectMeta(atSecond)),
        listDeliverables: vi.fn().mockResolvedValue([]),
      });
      const service = new WizardService(mockRepo);

      const state = await service.goBackStep('proj-1', StepId.RESEARCH_PLAN);

      expect(state.currentStep).toBe(StepId.CONTEXT_COLLECTION);
      expect(mockRepo.updateWizardState).toHaveBeenCalledOnce();
    });

    it('throws when already at first step', async () => {
      mockRepo = createMockRepo({
        get: vi.fn().mockResolvedValue(makeProjectMeta()),
        listDeliverables: vi.fn().mockResolvedValue([]),
      });
      const service = new WizardService(mockRepo);

      await expect(
        service.goBackStep('proj-1', StepId.CONTEXT_COLLECTION),
      ).rejects.toThrow('Already at the first step');
    });
  });
});
