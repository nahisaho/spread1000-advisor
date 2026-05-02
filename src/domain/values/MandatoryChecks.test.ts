import { describe, it, expect } from 'vitest';
import { runMandatoryChecks, runCrossPhaseChecks } from './MandatoryChecks';
import type { Proposal, ProposalSection } from '../models/Proposal';
import { SECTION_CHAR_LIMITS } from '../models/Proposal';
import type { CostEstimate, CostLineItem } from '../models/CostEstimate';

// --- helpers ---

function makeSection(
  id: ProposalSection['id'],
  content: string,
): ProposalSection {
  return {
    id,
    title: id,
    content,
    charLimit: SECTION_CHAR_LIMITS[id],
  };
}

function makeProposal(overrides: Partial<Record<ProposalSection['id'], string>> = {}): Proposal {
  const defaults: Record<ProposalSection['id'], string> = {
    research_purpose: 'A'.repeat(100),
    research_method: 'B'.repeat(200) + ' 研究期間は180日を予定しています。',
    ai_validity: 'C'.repeat(200),
    achievement_goals: 'D'.repeat(150),
    knowhow_sharing: 'E'.repeat(80),
    research_achievements: 'F'.repeat(100),
    expense_plan: '合計: 1,430,000円',
  };
  const merged = { ...defaults, ...overrides };
  return {
    projectId: 'test-project',
    sections: Object.entries(merged).map(([id, content]) =>
      makeSection(id as ProposalSection['id'], content),
    ),
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

function makeItem(overrides: Partial<CostLineItem> = {}): CostLineItem {
  return {
    resourceName: 'Azure VM',
    sku: 'Standard_B2s',
    region: 'japaneast',
    quantity: 1,
    unit: '台',
    unitPrice: 1_000_000,
    monthlyTotal: 1_000_000,
    verificationStatus: 'api_verified',
    ...overrides,
  };
}

function makeCostEstimate(overrides: Partial<CostEstimate> = {}): CostEstimate {
  const items = overrides.items ?? [makeItem()];
  const directCostTotal = overrides.directCostTotal ?? 1_100_000;
  const indirectCostTotal = overrides.indirectCostTotal ?? directCostTotal * 0.3;
  const base = {
    items,
    directCostTotal,
    indirectCostRate: 0.3 as const,
    indirectCostTotal,
    grandTotal: overrides.grandTotal ?? directCostTotal + indirectCostTotal,
    currency: 'JPY' as const,
    retrievedAt: '2024-01-01',
  };
  return { ...base, ...overrides, indirectCostRate: 0.3, currency: 'JPY' } as CostEstimate;
}

// --- tests ---

describe('runMandatoryChecks', () => {
  it('returns 10 check results', () => {
    const results = runMandatoryChecks(makeProposal(), makeCostEstimate());
    expect(results).toHaveLength(10);
  });

  it('all pass for a valid proposal', () => {
    const results = runMandatoryChecks(makeProposal(), makeCostEstimate());
    const failed = results.filter((r) => !r.passed);
    expect(failed).toEqual([]);
  });

  // --- individual checks ---

  describe('purpose-present', () => {
    it('passes when research_purpose has content', () => {
      const results = runMandatoryChecks(makeProposal(), makeCostEstimate());
      const check = results.find((r) => r.id === 'purpose-present')!;
      expect(check.passed).toBe(true);
    });

    it('fails when research_purpose is empty', () => {
      const results = runMandatoryChecks(
        makeProposal({ research_purpose: '' }),
        makeCostEstimate(),
      );
      const check = results.find((r) => r.id === 'purpose-present')!;
      expect(check.passed).toBe(false);
      expect(check.detail).toBeDefined();
    });

    it('fails when research_purpose is whitespace only', () => {
      const results = runMandatoryChecks(
        makeProposal({ research_purpose: '   ' }),
        makeCostEstimate(),
      );
      const check = results.find((r) => r.id === 'purpose-present')!;
      expect(check.passed).toBe(false);
    });
  });

  describe('ai-utilization', () => {
    it('passes when ai_validity has content', () => {
      const results = runMandatoryChecks(makeProposal(), makeCostEstimate());
      const check = results.find((r) => r.id === 'ai-utilization')!;
      expect(check.passed).toBe(true);
    });

    it('fails when ai_validity is empty', () => {
      const results = runMandatoryChecks(
        makeProposal({ ai_validity: '' }),
        makeCostEstimate(),
      );
      const check = results.find((r) => r.id === 'ai-utilization')!;
      expect(check.passed).toBe(false);
      expect(check.detail).toBeDefined();
    });
  });

  describe('period-within-180', () => {
    it('passes when period is 180 days', () => {
      const results = runMandatoryChecks(
        makeProposal({ research_method: 'B'.repeat(200) + ' 研究期間は180日です。' }),
        makeCostEstimate(),
      );
      const check = results.find((r) => r.id === 'period-within-180')!;
      expect(check.passed).toBe(true);
    });

    it('fails when period exceeds 180 days', () => {
      const results = runMandatoryChecks(
        makeProposal({ research_method: 'B'.repeat(200) + ' 研究期間は200日です。' }),
        makeCostEstimate(),
      );
      const check = results.find((r) => r.id === 'period-within-180')!;
      expect(check.passed).toBe(false);
      expect(check.detail).toContain('200');
    });

    it('parses month-based periods (6ヶ月 = 180日)', () => {
      const results = runMandatoryChecks(
        makeProposal({ research_method: 'B'.repeat(200) + ' 研究期間は6ヶ月です。' }),
        makeCostEstimate(),
      );
      const check = results.find((r) => r.id === 'period-within-180')!;
      expect(check.passed).toBe(true);
    });

    it('fails when period is not parseable', () => {
      const results = runMandatoryChecks(
        makeProposal({ research_method: 'B'.repeat(200) + ' 期間未定' }),
        makeCostEstimate(),
      );
      const check = results.find((r) => r.id === 'period-within-180')!;
      expect(check.passed).toBe(false);
      expect(check.detail).toContain('解析できません');
    });

    it('fails for 7ヶ月 (210 days)', () => {
      const results = runMandatoryChecks(
        makeProposal({ research_method: 'B'.repeat(200) + ' 7か月' }),
        makeCostEstimate(),
      );
      const check = results.find((r) => r.id === 'period-within-180')!;
      expect(check.passed).toBe(false);
    });
  });

  describe('direct-cost-limit', () => {
    it('passes when direct cost ≤ 5,000,000', () => {
      const results = runMandatoryChecks(
        makeProposal(),
        makeCostEstimate({ directCostTotal: 5_000_000 }),
      );
      const check = results.find((r) => r.id === 'direct-cost-limit')!;
      expect(check.passed).toBe(true);
    });

    it('fails when direct cost > 5,000,000', () => {
      const results = runMandatoryChecks(
        makeProposal(),
        makeCostEstimate({ directCostTotal: 5_000_001 }),
      );
      const check = results.find((r) => r.id === 'direct-cost-limit')!;
      expect(check.passed).toBe(false);
      expect(check.detail).toBeDefined();
    });
  });

  describe('indirect-cost-ratio', () => {
    it('passes when indirect = direct × 0.3', () => {
      const results = runMandatoryChecks(
        makeProposal(),
        makeCostEstimate({ directCostTotal: 1_000_000, indirectCostTotal: 300_000 }),
      );
      const check = results.find((r) => r.id === 'indirect-cost-ratio')!;
      expect(check.passed).toBe(true);
    });

    it('fails when indirect ≠ direct × 0.3', () => {
      const results = runMandatoryChecks(
        makeProposal(),
        makeCostEstimate({ directCostTotal: 1_000_000, indirectCostTotal: 500_000 }),
      );
      const check = results.find((r) => r.id === 'indirect-cost-ratio')!;
      expect(check.passed).toBe(false);
      expect(check.detail).toBeDefined();
    });
  });

  describe('char-limits', () => {
    it('passes when all sections are within char limits', () => {
      const results = runMandatoryChecks(makeProposal(), makeCostEstimate());
      const check = results.find((r) => r.id === 'char-limits')!;
      expect(check.passed).toBe(true);
    });

    it('fails when a section exceeds its max char limit', () => {
      const results = runMandatoryChecks(
        makeProposal({ research_purpose: 'X'.repeat(500) }), // max is 400
        makeCostEstimate(),
      );
      const check = results.find((r) => r.id === 'char-limits')!;
      expect(check.passed).toBe(false);
      expect(check.detail).toContain('research_purpose');
    });

    it('fails when a section is below its min char limit', () => {
      const results = runMandatoryChecks(
        makeProposal({ research_purpose: 'X'.repeat(10) }), // min is 80
        makeCostEstimate(),
      );
      const check = results.find((r) => r.id === 'char-limits')!;
      expect(check.passed).toBe(false);
    });
  });

  describe('azure-resources', () => {
    it('passes when cost estimate has items', () => {
      const results = runMandatoryChecks(makeProposal(), makeCostEstimate());
      const check = results.find((r) => r.id === 'azure-resources')!;
      expect(check.passed).toBe(true);
    });

    it('fails when cost estimate has no items', () => {
      const results = runMandatoryChecks(
        makeProposal(),
        makeCostEstimate({ items: [] }),
      );
      const check = results.find((r) => r.id === 'azure-resources')!;
      expect(check.passed).toBe(false);
      expect(check.detail).toBeDefined();
    });
  });

  describe('cost-detail', () => {
    it('passes when cost estimate has items', () => {
      const results = runMandatoryChecks(makeProposal(), makeCostEstimate());
      const check = results.find((r) => r.id === 'cost-detail')!;
      expect(check.passed).toBe(true);
    });

    it('fails when cost estimate has no items', () => {
      const results = runMandatoryChecks(
        makeProposal(),
        makeCostEstimate({ items: [] }),
      );
      const check = results.find((r) => r.id === 'cost-detail')!;
      expect(check.passed).toBe(false);
    });
  });

  describe('achievements-present', () => {
    it('passes when research_achievements has content', () => {
      const results = runMandatoryChecks(makeProposal(), makeCostEstimate());
      const check = results.find((r) => r.id === 'achievements-present')!;
      expect(check.passed).toBe(true);
    });

    it('fails when research_achievements is empty', () => {
      const results = runMandatoryChecks(
        makeProposal({ research_achievements: '' }),
        makeCostEstimate(),
      );
      const check = results.find((r) => r.id === 'achievements-present')!;
      expect(check.passed).toBe(false);
      expect(check.detail).toBeDefined();
    });
  });

  describe('knowledge-sharing', () => {
    it('passes when knowhow_sharing has content', () => {
      const results = runMandatoryChecks(makeProposal(), makeCostEstimate());
      const check = results.find((r) => r.id === 'knowledge-sharing')!;
      expect(check.passed).toBe(true);
    });

    it('fails when knowhow_sharing is empty', () => {
      const results = runMandatoryChecks(
        makeProposal({ knowhow_sharing: '' }),
        makeCostEstimate(),
      );
      const check = results.find((r) => r.id === 'knowledge-sharing')!;
      expect(check.passed).toBe(false);
      expect(check.detail).toBeDefined();
    });
  });

  describe('empty proposal', () => {
    it('fails most checks for a completely empty proposal', () => {
      const emptyProposal = makeProposal({
        research_purpose: '',
        research_method: '',
        ai_validity: '',
        achievement_goals: '',
        knowhow_sharing: '',
        research_achievements: '',
        expense_plan: '',
      });
      const results = runMandatoryChecks(emptyProposal, makeCostEstimate({ items: [] }));
      const passed = results.filter((r) => r.passed);
      // Only indirect-cost-ratio and direct-cost-limit might pass with default amounts
      expect(passed.length).toBeLessThanOrEqual(3);
      // These should definitely fail
      expect(results.find((r) => r.id === 'purpose-present')!.passed).toBe(false);
      expect(results.find((r) => r.id === 'ai-utilization')!.passed).toBe(false);
      expect(results.find((r) => r.id === 'azure-resources')!.passed).toBe(false);
      expect(results.find((r) => r.id === 'cost-detail')!.passed).toBe(false);
      expect(results.find((r) => r.id === 'achievements-present')!.passed).toBe(false);
      expect(results.find((r) => r.id === 'knowledge-sharing')!.passed).toBe(false);
    });
  });
});

describe('runCrossPhaseChecks', () => {
  it('passes when expense_plan mentions the grand total', () => {
    const cost = makeCostEstimate({
      directCostTotal: 1_100_000,
      indirectCostTotal: 330_000,
      grandTotal: 1_430_000,
    });
    const proposal = makeProposal({ expense_plan: '合計: 1,430,000円の予算を計上' });
    const results = runCrossPhaseChecks(proposal, cost);
    const check = results.find((r) => r.id === 'cost-consistency')!;
    expect(check.passed).toBe(true);
  });

  it('passes when expense_plan mentions the raw grand total number', () => {
    const cost = makeCostEstimate({
      directCostTotal: 1_100_000,
      indirectCostTotal: 330_000,
      grandTotal: 1_430_000,
    });
    const proposal = makeProposal({ expense_plan: '合計1430000円を計上' });
    const results = runCrossPhaseChecks(proposal, cost);
    const check = results.find((r) => r.id === 'cost-consistency')!;
    expect(check.passed).toBe(true);
  });

  it('fails when expense_plan does not mention the total', () => {
    const cost = makeCostEstimate({
      directCostTotal: 1_100_000,
      indirectCostTotal: 330_000,
      grandTotal: 1_430_000,
    });
    const proposal = makeProposal({ expense_plan: 'Azure VMを使用する予定です。' });
    const results = runCrossPhaseChecks(proposal, cost);
    const check = results.find((r) => r.id === 'cost-consistency')!;
    expect(check.passed).toBe(false);
    expect(check.detail).toContain('1,430,000');
  });

  it('fails when expense_plan is empty', () => {
    const results = runCrossPhaseChecks(
      makeProposal({ expense_plan: '' }),
      makeCostEstimate(),
    );
    const check = results.find((r) => r.id === 'cost-consistency')!;
    expect(check.passed).toBe(false);
    expect(check.detail).toContain('空です');
  });

  it('returns at least 1 cross-phase check result', () => {
    const results = runCrossPhaseChecks(makeProposal(), makeCostEstimate());
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
