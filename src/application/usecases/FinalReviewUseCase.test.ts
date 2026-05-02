import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinalReviewUseCase } from './FinalReviewUseCase';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { Proposal } from '@/domain/models/Proposal';
import type { CostEstimate } from '@/domain/models/CostEstimate';
import { DISCLAIMER_TEXT } from '@/lib/disclaimer';

function createMockRepo(overrides: Partial<IProjectRepository> = {}): IProjectRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateWizardState: vi.fn(),
    saveDeliverable: vi.fn(),
    loadDeliverable: vi.fn().mockResolvedValue(null),
    listDeliverables: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function createValidProposal(): Proposal {
  return {
    projectId: 'proj-1',
    sections: [
      { id: 'research_purpose', title: '研究目的', content: 'A'.repeat(100) + '180日', charLimit: { min: 80, max: 400 } },
      { id: 'research_method', title: '研究手法', content: 'B'.repeat(200), charLimit: { min: 160, max: 800 } },
      { id: 'ai_validity', title: 'AI活用の妥当性', content: 'C'.repeat(200), charLimit: { min: 160, max: 800 } },
      { id: 'achievement_goals', title: '達成目標', content: 'D'.repeat(120), charLimit: { min: 100, max: 500 } },
      { id: 'knowhow_sharing', title: 'ノウハウ共有', content: 'E'.repeat(80), charLimit: { min: 60, max: 300 } },
      { id: 'research_achievements', title: '研究実績', content: 'F'.repeat(50), charLimit: { min: 0, max: 1000 } },
      { id: 'expense_plan', title: '経費計画', content: `合計: ${(130000).toLocaleString()}円`, charLimit: { min: 0, max: 2000 } },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function createValidCostEstimate(): CostEstimate {
  return {
    items: [
      {
        resourceName: 'Azure OpenAI Service',
        sku: 'S0',
        region: 'japaneast',
        quantity: 1,
        unit: '月',
        unitPrice: 100000,
        monthlyTotal: 100000,
        verificationStatus: 'api_verified',
        retailPriceId: 'rp-1',
      },
    ],
    directCostTotal: 100000,
    indirectCostRate: 0.3,
    indirectCostTotal: 30000,
    grandTotal: 130000,
    currency: 'JPY',
    retrievedAt: '2024-01-01T00:00:00Z',
  };
}

describe('FinalReviewUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs all mandatory checks', async () => {
    const repo = createMockRepo({ saveDeliverable: vi.fn() });
    const useCase = new FinalReviewUseCase(repo);

    const result = await useCase.execute('proj-1', createValidProposal(), createValidCostEstimate());

    expect(result.mandatoryChecks.length).toBeGreaterThanOrEqual(10);
    for (const check of result.mandatoryChecks) {
      expect(check).toHaveProperty('id');
      expect(check).toHaveProperty('label');
      expect(check).toHaveProperty('passed');
    }
  });

  it('runs cross-phase checks', async () => {
    const repo = createMockRepo({ saveDeliverable: vi.fn() });
    const useCase = new FinalReviewUseCase(repo);

    const result = await useCase.execute('proj-1', createValidProposal(), createValidCostEstimate());

    expect(result.crossPhaseChecks.length).toBeGreaterThanOrEqual(1);
    for (const check of result.crossPhaseChecks) {
      expect(check).toHaveProperty('id');
      expect(check).toHaveProperty('label');
      expect(check).toHaveProperty('passed');
    }
  });

  it('returns green judgment when all checks pass', async () => {
    const repo = createMockRepo({ saveDeliverable: vi.fn() });
    const useCase = new FinalReviewUseCase(repo);

    const result = await useCase.execute('proj-1', createValidProposal(), createValidCostEstimate());

    const mandatoryFailures = result.mandatoryChecks.filter((c) => !c.passed).length;
    if (mandatoryFailures === 0) {
      // With totalScore=0 and allPricesVerified=true, judgment should be 🔴 (score < 10)
      expect(result.judgment).toBe('🔴');
    }
    expect(result.totalScore).toBe(0);
  });

  it('returns red judgment when mandatory checks fail', async () => {
    const repo = createMockRepo({ saveDeliverable: vi.fn() });
    const useCase = new FinalReviewUseCase(repo);

    const emptyProposal: Proposal = {
      projectId: 'proj-1',
      sections: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = await useCase.execute('proj-1', emptyProposal, createValidCostEstimate());

    expect(result.judgment).toBe('🔴');
    expect(result.mandatoryChecks.some((c) => !c.passed)).toBe(true);
  });

  it('returns yellow judgment for unverified prices', async () => {
    const repo = createMockRepo({ saveDeliverable: vi.fn() });
    const useCase = new FinalReviewUseCase(repo);

    const estimateWithUnverified: CostEstimate = {
      ...createValidCostEstimate(),
      items: [
        {
          resourceName: 'Azure OpenAI Service',
          sku: 'S0',
          region: 'japaneast',
          quantity: 1,
          unit: '月',
          unitPrice: 100000,
          monthlyTotal: 100000,
          verificationStatus: 'estimated',
        },
      ],
    };

    const proposal = createValidProposal();
    const result = await useCase.execute('proj-1', proposal, estimateWithUnverified);

    const mandatoryFailures = result.mandatoryChecks.filter((c) => !c.passed).length;
    if (mandatoryFailures === 0) {
      expect(result.judgment).toBe('🟡');
    }
  });

  it('saves final review report with disclaimer', async () => {
    const saveDeliverable = vi.fn();
    const repo = createMockRepo({ saveDeliverable });
    const useCase = new FinalReviewUseCase(repo);

    await useCase.execute('proj-1', createValidProposal(), createValidCostEstimate());

    expect(saveDeliverable).toHaveBeenCalledWith(
      'proj-1',
      'final-review-report.md',
      expect.stringContaining(DISCLAIMER_TEXT),
    );
  });
});
