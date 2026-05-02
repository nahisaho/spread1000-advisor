import { describe, it, expect } from 'vitest';
import { ValidationService } from './ValidationService';
import type { DeliverableName } from '@/domain/interfaces/IProjectRepository';
import { StepId } from '@/domain/models/WizardStep';

describe('ValidationService', () => {
  const service = new ValidationService();

  it('returns valid when required deliverable exists', () => {
    const deliverables: DeliverableName[] = ['meta-prompt.md', 'phase0-research-plan.md'];
    const result = service.validateStepCompletion(StepId.CONTEXT_COLLECTION, deliverables);

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('returns invalid with missing deliverable name', () => {
    const deliverables: DeliverableName[] = [];
    const result = service.validateStepCompletion(StepId.CONTEXT_COLLECTION, deliverables);

    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['meta-prompt.md']);
  });

  it('validates each step against its mapped deliverable', () => {
    const deliverables: DeliverableName[] = ['phase1-azure-architecture.md'];

    expect(service.validateStepCompletion(StepId.AZURE_ARCHITECTURE, deliverables).valid).toBe(true);
    expect(service.validateStepCompletion(StepId.COST_ESTIMATE, deliverables).valid).toBe(false);
    expect(service.validateStepCompletion(StepId.COST_ESTIMATE, deliverables).missing).toEqual(['phase2-cost-estimate.md']);
  });

  it('validates proposal step', () => {
    const result = service.validateStepCompletion(StepId.PROPOSAL, ['phase3-proposal.md']);
    expect(result.valid).toBe(true);
  });

  it('validates review steps', () => {
    const resultReview = service.validateStepCompletion(StepId.PROPOSAL_REVIEW, ['review-report.md']);
    expect(resultReview.valid).toBe(true);

    const resultFinal = service.validateStepCompletion(StepId.FINAL_REVIEW, []);
    expect(resultFinal.valid).toBe(false);
    expect(resultFinal.missing).toEqual(['final-review-report.md']);
  });
});
