import type { Proposal, ProposalSectionId } from '../models/Proposal';
import { validateCharacterCount } from '../models/Proposal';
import type { CostEstimate } from '../models/CostEstimate';
import { validateBudget } from '../models/CostEstimate';

export type MandatoryCheckId =
  | 'purpose-present'
  | 'ai-utilization'
  | 'period-within-180'
  | 'direct-cost-limit'
  | 'indirect-cost-ratio'
  | 'char-limits'
  | 'azure-resources'
  | 'cost-detail'
  | 'achievements-present'
  | 'knowledge-sharing';

export interface MandatoryCheckResult {
  readonly id: MandatoryCheckId;
  readonly label: string;
  readonly passed: boolean;
  readonly detail?: string;
}

export interface CrossPhaseCheckResult {
  readonly id: string;
  readonly label: string;
  readonly passed: boolean;
  readonly detail?: string;
}

function findSection(proposal: Proposal, sectionId: ProposalSectionId) {
  return proposal.sections.find((s) => s.id === sectionId);
}

function isSectionPresent(proposal: Proposal, sectionId: ProposalSectionId): boolean {
  const section = findSection(proposal, sectionId);
  return section !== undefined && section.content.trim().length > 0;
}

function parsePeriodDays(content: string): number | null {
  // Match patterns like "180日", "90日間", "6ヶ月" etc.
  const dayMatch = content.match(/(\d+)\s*日/);
  if (dayMatch) return parseInt(dayMatch[1], 10);

  const monthMatch = content.match(/(\d+)\s*[ヶか箇カ]?\s*月/);
  if (monthMatch) return parseInt(monthMatch[1], 10) * 30;

  return null;
}

export function runMandatoryChecks(
  proposal: Proposal,
  costEstimate: CostEstimate,
): MandatoryCheckResult[] {
  const budget = validateBudget(costEstimate);

  const results: MandatoryCheckResult[] = [
    // 1. purpose-present
    {
      id: 'purpose-present',
      label: '研究目的が記載されている',
      passed: isSectionPresent(proposal, 'research_purpose'),
      ...(!isSectionPresent(proposal, 'research_purpose') && {
        detail: '研究目的セクションが空です',
      }),
    },
    // 2. ai-utilization
    {
      id: 'ai-utilization',
      label: 'AI活用の妥当性が説明されている',
      passed: isSectionPresent(proposal, 'ai_validity'),
      ...(!isSectionPresent(proposal, 'ai_validity') && {
        detail: 'AI活用セクションが空です',
      }),
    },
    // 3. period-within-180
    (() => {
      // Parse period from research_purpose and research_method sections only
      const periodSections = proposal.sections
        .filter((s) => s.id === 'research_purpose' || s.id === 'research_method')
        .map((s) => s.content)
        .join(' ');
      const days = parsePeriodDays(periodSections);
      if (days === null) {
        return {
          id: 'period-within-180' as const,
          label: '研究期間が180日以内',
          passed: false,
          detail: '研究目的・研究手法セクションから研究期間を解析できませんでした',
        };
      }
      return {
        id: 'period-within-180' as const,
        label: '研究期間が180日以内',
        passed: days <= 180,
        ...(days > 180 && { detail: `研究期間が${days}日で180日を超えています` }),
      };
    })(),
    // 4. direct-cost-limit
    {
      id: 'direct-cost-limit',
      label: '直接経費 ≤ 500万円',
      passed: budget.withinLimit,
      ...(!budget.withinLimit && {
        detail: `直接経費が${costEstimate.directCostTotal.toLocaleString()}円で上限を超えています`,
      }),
    },
    // 5. indirect-cost-ratio
    {
      id: 'indirect-cost-ratio',
      label: '間接経費 = 直接経費 × 30%',
      passed: budget.indirectCorrect,
      ...(!budget.indirectCorrect && {
        detail: `間接経費が${costEstimate.indirectCostTotal.toLocaleString()}円（期待値: ${(costEstimate.directCostTotal * 0.3).toLocaleString()}円）`,
      }),
    },
    // 6. char-limits
    (() => {
      const violations = proposal.sections
        .map((s) => ({ section: s, result: validateCharacterCount(s) }))
        .filter((v) => !v.result.valid);
      return {
        id: 'char-limits' as const,
        label: '全セクションが文字数制限内',
        passed: violations.length === 0,
        ...(violations.length > 0 && {
          detail: `${violations.map((v) => v.section.id).join(', ')} が文字数制限違反`,
        }),
      };
    })(),
    // 7. azure-resources — check that items reference Azure services
    (() => {
      const hasAzureItems = costEstimate.items.some(
        (item) =>
          item.resourceName.toLowerCase().includes('azure') ||
          item.sku.toLowerCase().includes('azure')
      );
      return {
        id: 'azure-resources' as const,
        label: 'Azure リソースが記載されている',
        passed: hasAzureItems,
        ...(!hasAzureItems && {
          detail: 'Azure サービスを含むコスト項目がありません',
        }),
      };
    })(),
    // 8. cost-detail — check that items have complete information
    (() => {
      const hasCompleteItems =
        costEstimate.items.length > 0 &&
        costEstimate.items.every(
          (item) =>
            item.resourceName.trim().length > 0 &&
            item.quantity > 0 &&
            item.unitPrice > 0
        );
      return {
        id: 'cost-detail' as const,
        label: 'コスト明細が完備している',
        passed: hasCompleteItems,
        ...(!hasCompleteItems && {
          detail:
            costEstimate.items.length === 0
              ? 'コスト明細が存在しません'
              : '不完全なコスト項目があります（サービス名・数量・単価を確認）',
        }),
      };
    })(),
    // 9. achievements-present
    {
      id: 'achievements-present',
      label: '研究実績が記載されている',
      passed: isSectionPresent(proposal, 'research_achievements'),
      ...(!isSectionPresent(proposal, 'research_achievements') && {
        detail: '研究実績セクションが空です',
      }),
    },
    // 10. knowledge-sharing
    {
      id: 'knowledge-sharing',
      label: 'ノウハウ共有方法が記載されている',
      passed: isSectionPresent(proposal, 'knowhow_sharing'),
      ...(!isSectionPresent(proposal, 'knowhow_sharing') && {
        detail: 'ノウハウ共有セクションが空です',
      }),
    },
  ];

  return results;
}

export function runCrossPhaseChecks(
  proposal: Proposal,
  costEstimate: CostEstimate,
): CrossPhaseCheckResult[] {
  const results: CrossPhaseCheckResult[] = [];

  // cost-consistency: コスト見積もり合計と経費計画セクションの整合性
  const expensePlan = findSection(proposal, 'expense_plan');
  const totalStr = costEstimate.grandTotal.toLocaleString();

  if (expensePlan && expensePlan.content.trim().length > 0) {
    const mentionsTotal =
      expensePlan.content.includes(String(costEstimate.grandTotal)) ||
      expensePlan.content.includes(totalStr);
    results.push({
      id: 'cost-consistency',
      label: 'コスト見積もりと経費計画の整合性',
      passed: mentionsTotal,
      ...(!mentionsTotal && {
        detail: `経費計画セクションにコスト合計（${totalStr}円）が記載されていません`,
      }),
    });
  } else {
    results.push({
      id: 'cost-consistency',
      label: 'コスト見積もりと経費計画の整合性',
      passed: false,
      detail: '経費計画セクションが空です',
    });
  }

  return results;
}
