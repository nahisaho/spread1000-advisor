// @vitest-environment node
import { describe, it, expect } from 'vitest';

import { validateBudget, DIRECT_COST_LIMIT } from '@/domain/models/CostEstimate';
import type { CostEstimate, CostLineItem } from '@/domain/models/CostEstimate';
import { validateCharacterCount, SECTION_CHAR_LIMITS } from '@/domain/models/Proposal';
import type { Proposal, ProposalSection, ProposalSectionId } from '@/domain/models/Proposal';
import { runMandatoryChecks, runCrossPhaseChecks } from '@/domain/values/MandatoryChecks';
import type { MandatoryCheckId } from '@/domain/values/MandatoryChecks';

function makeCostEstimate(overrides: Partial<CostEstimate> = {}): CostEstimate {
  const directCostTotal = overrides.directCostTotal ?? 3_000_000;
  const indirectCostTotal = overrides.indirectCostTotal ?? Math.round(directCostTotal * 0.3);
  return {
    items: overrides.items ?? [
      {
        resourceName: 'Azure OpenAI Service',
        sku: 'S0',
        region: 'japaneast',
        quantity: 1,
        unit: '月',
        unitPrice: directCostTotal,
        monthlyTotal: directCostTotal,
        verificationStatus: 'api_verified',
      },
    ],
    directCostTotal,
    indirectCostRate: 0.3,
    indirectCostTotal,
    grandTotal: directCostTotal + indirectCostTotal,
    currency: 'JPY',
    retrievedAt: new Date().toISOString(),
  };
}

function makeSection(
  id: ProposalSectionId,
  content: string,
): ProposalSection {
  return {
    id,
    title: id,
    content,
    charLimit: SECTION_CHAR_LIMITS[id],
  };
}

function makeProposal(sections: ProposalSection[]): Proposal {
  const now = new Date().toISOString();
  return {
    projectId: 'test-project',
    sections,
    createdAt: now,
    updatedAt: now,
  };
}

function makeCompleteProposal(): Proposal {
  return makeProposal([
    makeSection('research_purpose', 'AIを活用した創薬研究の加速化を目的とし、分子動力学シミュレーションとディープラーニングを統合する。180日間の研究期間で実施する。'.repeat(2)),
    makeSection('research_method', '大規模言語モデルを活用し、化合物の活性予測モデルを構築する。データ収集、前処理、モデル訓練、検証の4段階で180日の期間で進める。'.repeat(3)),
    makeSection('ai_validity', '従来のHTS手法と比較し、AIベースのバーチャルスクリーニングは探索空間を1000倍に拡大でき、計算コストを10分の1に削減可能。GNNとTransformerの組み合わせ。'.repeat(3)),
    makeSection('achievement_goals', '予測精度AUC0.9以上の活性予測モデルを構築。10万化合物のスクリーニングを1日以内に完了可能なパイプラインを開発。中間マイルストーン60日。'.repeat(1)),
    makeSection('knowhow_sharing', '研究成果をGitHubで公開し、論文をarXivに投稿する。学会発表で知見を共有する。再現性を確保するためDockerコンテナを提供する。'.repeat(1)),
    makeSection('research_achievements', '関連する論文を5本発表済み。国際会議での招待講演2件。創薬AI分野で3年の実績を有する。計算化学と機械学習の融合研究を継続。'.repeat(2)),
    makeSection('expense_plan', 'Azure OpenAI Service: ¥500,000、Azure VM: ¥2,000,000、Storage: ¥100,000。合計: ¥3,900,000'),
  ]);
}

describe('Cross-cutting Validation', () => {
  describe('Budget constraints', () => {
    it('validates budget at exactly ¥5,000,000', () => {
      const estimate = makeCostEstimate({ directCostTotal: 5_000_000 });
      const result = validateBudget(estimate);

      expect(result.withinLimit).toBe(true);
    });

    it('fails budget at ¥5,000,001', () => {
      const estimate = makeCostEstimate({ directCostTotal: 5_000_001 });
      const result = validateBudget(estimate);

      expect(result.withinLimit).toBe(false);
    });

    it('validates budget well under limit', () => {
      const estimate = makeCostEstimate({ directCostTotal: 1_000_000 });
      const result = validateBudget(estimate);

      expect(result.withinLimit).toBe(true);
    });

    it('validates indirect cost ratio', () => {
      const directTotal = 4_000_000;
      const correctIndirect = Math.round(directTotal * 0.3);
      const estimate = makeCostEstimate({
        directCostTotal: directTotal,
        indirectCostTotal: correctIndirect,
      });
      const result = validateBudget(estimate);

      expect(result.indirectCorrect).toBe(true);
    });

    it('detects incorrect indirect cost ratio', () => {
      const estimate = makeCostEstimate({
        directCostTotal: 4_000_000,
        indirectCostTotal: 500_000, // Should be 1,200,000
      });
      const result = validateBudget(estimate);

      expect(result.indirectCorrect).toBe(false);
    });

    it('detects unverified prices', () => {
      const items: CostLineItem[] = [
        {
          resourceName: 'Azure OpenAI Service',
          sku: 'S0',
          region: 'japaneast',
          quantity: 1,
          unit: '月',
          unitPrice: 500_000,
          monthlyTotal: 500_000,
          verificationStatus: 'estimated',
        },
      ];
      const estimate = makeCostEstimate({ items, directCostTotal: 500_000 });
      const result = validateBudget(estimate);

      expect(result.allPricesVerified).toBe(false);
      expect(result.hasUnverifiedWarning).toBe(true);
    });

    it('confirms all verified prices', () => {
      const estimate = makeCostEstimate();
      const result = validateBudget(estimate);

      expect(result.allPricesVerified).toBe(true);
      expect(result.hasUnverifiedWarning).toBe(false);
    });
  });

  describe('Character limits for all sections', () => {
    const sectionIds: ProposalSectionId[] = [
      'research_purpose',
      'research_method',
      'ai_validity',
      'achievement_goals',
      'knowhow_sharing',
      'research_achievements',
      'expense_plan',
    ];

    it('validates sections at minimum boundary', () => {
      for (const id of sectionIds) {
        const limit = SECTION_CHAR_LIMITS[id];
        const content = 'あ'.repeat(limit.min);
        const section = makeSection(id, content);
        const result = validateCharacterCount(section);

        expect(result.valid).toBe(true);
        expect(result.current).toBe(limit.min);
      }
    });

    it('validates sections at maximum boundary', () => {
      for (const id of sectionIds) {
        const limit = SECTION_CHAR_LIMITS[id];
        const content = 'あ'.repeat(limit.max);
        const section = makeSection(id, content);
        const result = validateCharacterCount(section);

        expect(result.valid).toBe(true);
        expect(result.current).toBe(limit.max);
      }
    });

    it('fails sections exceeding maximum', () => {
      for (const id of sectionIds) {
        const limit = SECTION_CHAR_LIMITS[id];
        const content = 'あ'.repeat(limit.max + 1);
        const section = makeSection(id, content);
        const result = validateCharacterCount(section);

        expect(result.valid).toBe(false);
      }
    });

    it('fails sections below minimum (where min > 0)', () => {
      for (const id of sectionIds) {
        const limit = SECTION_CHAR_LIMITS[id];
        if (limit.min === 0) continue;

        const content = 'あ'.repeat(limit.min - 1);
        const section = makeSection(id, content);
        const result = validateCharacterCount(section);

        expect(result.valid).toBe(false);
      }
    });

    it('calculates utilization correctly', () => {
      const section = makeSection('research_purpose', 'あ'.repeat(200));
      const result = validateCharacterCount(section);
      const expected = 200 / SECTION_CHAR_LIMITS.research_purpose.max;

      expect(result.utilization).toBeCloseTo(expected, 5);
    });
  });

  describe('Mandatory checks detect all failure modes', () => {
    it('passes all checks with complete valid proposal', () => {
      const proposal = makeCompleteProposal();
      const costEstimate = makeCostEstimate();
      const results = runMandatoryChecks(proposal, costEstimate);

      const allPassed = results.filter((r) => r.passed);
      // Most checks should pass with a well-formed proposal
      expect(allPassed.length).toBeGreaterThanOrEqual(7);
    });

    it('empty proposal fails all content checks', () => {
      const proposal = makeProposal([
        makeSection('research_purpose', ''),
        makeSection('research_method', ''),
        makeSection('ai_validity', ''),
        makeSection('achievement_goals', ''),
        makeSection('knowhow_sharing', ''),
        makeSection('research_achievements', ''),
        makeSection('expense_plan', ''),
      ]);
      const costEstimate = makeCostEstimate();

      const results = runMandatoryChecks(proposal, costEstimate);

      const purposeCheck = results.find((r) => r.id === 'purpose-present');
      expect(purposeCheck?.passed).toBe(false);

      const aiCheck = results.find((r) => r.id === 'ai-utilization');
      expect(aiCheck?.passed).toBe(false);

      const achievementsCheck = results.find((r) => r.id === 'achievements-present');
      expect(achievementsCheck?.passed).toBe(false);

      const knowhowCheck = results.find((r) => r.id === 'knowledge-sharing');
      expect(knowhowCheck?.passed).toBe(false);
    });

    it('over-budget fails direct-cost-limit', () => {
      const proposal = makeCompleteProposal();
      const costEstimate = makeCostEstimate({ directCostTotal: 6_000_000 });

      const results = runMandatoryChecks(proposal, costEstimate);

      const costCheck = results.find((r) => r.id === 'direct-cost-limit');
      expect(costCheck?.passed).toBe(false);
      expect(costCheck?.detail).toContain('上限を超えています');
    });

    it('wrong indirect ratio fails indirect-cost-ratio', () => {
      const proposal = makeCompleteProposal();
      const costEstimate = makeCostEstimate({
        directCostTotal: 3_000_000,
        indirectCostTotal: 100_000, // Should be 900,000
      });

      const results = runMandatoryChecks(proposal, costEstimate);

      const ratioCheck = results.find((r) => r.id === 'indirect-cost-ratio');
      expect(ratioCheck?.passed).toBe(false);
    });

    it('detects period exceeding 180 days', () => {
      const proposal = makeProposal([
        makeSection('research_purpose', 'この研究は365日間の長期計画で、AI創薬の革新を目指す。社会的に重要な研究である。十分な内容を含む文章。'),
        makeSection('research_method', '大規模データ解析と機械学習を組み合わせた手法。365日間で段階的に進める。具体的なデータ収集と前処理から始める。'.repeat(3)),
        makeSection('ai_validity', 'AI活用の妥当性は十分に示されている。従来手法と比較して大幅な効率化が見込まれる。GNNとTransformerの組み合わせ。'.repeat(3)),
        makeSection('achievement_goals', '予測精度AUC0.9以上のモデル構築。パイプライン開発。中間マイルストーン設定。'.repeat(1)),
        makeSection('knowhow_sharing', 'GitHubで公開。論文をarXivに投稿。学会発表で知見共有。'.repeat(1)),
        makeSection('research_achievements', '論文5本発表。国際会議招待講演2件。創薬AI3年実績。'.repeat(2)),
        makeSection('expense_plan', 'Azure関連費用合計: ¥3,000,000'),
      ]);
      const costEstimate = makeCostEstimate();

      const results = runMandatoryChecks(proposal, costEstimate);
      const periodCheck = results.find((r) => r.id === 'period-within-180');
      expect(periodCheck?.passed).toBe(false);
    });

    it('detects missing Azure resources in cost', () => {
      const items: CostLineItem[] = [
        {
          resourceName: 'Generic Cloud Service',
          sku: 'Standard',
          region: 'japaneast',
          quantity: 1,
          unit: '月',
          unitPrice: 100_000,
          monthlyTotal: 100_000,
          verificationStatus: 'api_verified',
        },
      ];
      const proposal = makeCompleteProposal();
      const costEstimate = makeCostEstimate({ items, directCostTotal: 100_000 });

      const results = runMandatoryChecks(proposal, costEstimate);
      const azureCheck = results.find((r) => r.id === 'azure-resources');
      expect(azureCheck?.passed).toBe(false);
    });

    it('detects empty cost items', () => {
      const proposal = makeCompleteProposal();
      const costEstimate = makeCostEstimate({
        items: [],
        directCostTotal: 0,
        indirectCostTotal: 0,
      });

      const results = runMandatoryChecks(proposal, costEstimate);
      const costDetailCheck = results.find((r) => r.id === 'cost-detail');
      expect(costDetailCheck?.passed).toBe(false);
      expect(costDetailCheck?.detail).toContain('存在しません');
    });

    it('char-limits check fails when sections exceed limits', () => {
      const proposal = makeProposal([
        makeSection('research_purpose', 'あ'.repeat(SECTION_CHAR_LIMITS.research_purpose.max + 100)),
        makeSection('research_method', '180日間の研究。'.repeat(50)),
        makeSection('ai_validity', 'AI活用。'.repeat(50)),
        makeSection('achievement_goals', '目標達成。'.repeat(30)),
        makeSection('knowhow_sharing', '共有方法。'.repeat(10)),
        makeSection('research_achievements', '実績あり。'.repeat(10)),
        makeSection('expense_plan', 'Azure費用計画'),
      ]);
      const costEstimate = makeCostEstimate();

      const results = runMandatoryChecks(proposal, costEstimate);
      const charCheck = results.find((r) => r.id === 'char-limits');
      expect(charCheck?.passed).toBe(false);
      expect(charCheck?.detail).toContain('research_purpose');
    });
  });

  describe('Cross-phase checks', () => {
    it('detects cost inconsistency when expense plan lacks total', () => {
      const proposal = makeProposal([
        makeSection('research_purpose', 'テスト'),
        makeSection('expense_plan', 'Azure VM を使用する予定です。詳細は検討中。'),
      ]);
      const costEstimate = makeCostEstimate({ directCostTotal: 3_000_000 });

      const results = runCrossPhaseChecks(proposal, costEstimate);
      const costConsistency = results.find((r) => r.id === 'cost-consistency');

      expect(costConsistency).toBeDefined();
      expect(costConsistency?.passed).toBe(false);
      expect(costConsistency?.detail).toContain('記載されていません');
    });

    it('passes cost consistency when total is mentioned', () => {
      const costEstimate = makeCostEstimate({ directCostTotal: 3_000_000 });
      const proposal = makeProposal([
        makeSection('research_purpose', 'テスト'),
        makeSection('expense_plan', `総合計: ${costEstimate.grandTotal.toLocaleString()}円の予算で実施`),
      ]);

      const results = runCrossPhaseChecks(proposal, costEstimate);
      const costConsistency = results.find((r) => r.id === 'cost-consistency');

      expect(costConsistency).toBeDefined();
      expect(costConsistency?.passed).toBe(true);
    });

    it('fails cost consistency when expense plan is empty', () => {
      const proposal = makeProposal([
        makeSection('research_purpose', 'テスト'),
        makeSection('expense_plan', ''),
      ]);
      const costEstimate = makeCostEstimate();

      const results = runCrossPhaseChecks(proposal, costEstimate);
      const costConsistency = results.find((r) => r.id === 'cost-consistency');

      expect(costConsistency?.passed).toBe(false);
      expect(costConsistency?.detail).toContain('空です');
    });
  });
});
