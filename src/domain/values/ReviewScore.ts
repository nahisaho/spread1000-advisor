export type ScoreGrade = '◎' | '○' | '△' | '×';

export const GRADE_POINTS: Record<ScoreGrade, number> = {
  '◎': 3, '○': 2, '△': 1, '×': 0,
};

/**
 * 6 review criteria aligned with SPReAD-1000 evaluation guidelines.
 * Used by both domain scoring and LLM reviewer prompts.
 */
export type ReviewCriterionId =
  | 'social_impact'
  | 'ai_validity'
  | 'methodology_specificity'
  | 'azure_utilization'
  | 'research_capability'
  | 'cost_plan_validity';

/** Canonical criterion labels (Japanese) */
export const REVIEW_CRITERION_LABELS: Record<ReviewCriterionId, string> = {
  social_impact: '研究の社会的意義',
  ai_validity: 'AI活用の妥当性',
  methodology_specificity: '研究手法の具体性',
  azure_utilization: 'Azure活用度',
  research_capability: '研究遂行能力',
  cost_plan_validity: 'コスト計画の妥当性',
};

export interface CriterionScore {
  readonly criterionId: ReviewCriterionId;
  readonly criterionName: string;
  readonly grade: ScoreGrade;
  readonly points: number;
  readonly suggestion: string;
}

export type SubmissionJudgment = '🟢' | '🟡' | '🔴';

export interface MandatoryCheckResult {
  readonly item: string;
  readonly passed: boolean;
}

export interface CrossPhaseCheckResult {
  readonly check: string;
  readonly phases: string;
  readonly status: 'pass' | 'warning' | 'fail';
  readonly detail: string;
}

export interface ActionItem {
  readonly priority: 'High' | 'Medium' | 'Low';
  readonly description: string;
  readonly relatedSection: string;
}

export interface ReviewResult {
  readonly criteria: readonly CriterionScore[];
  readonly totalScore: number;
  readonly judgment: SubmissionJudgment;
  readonly mandatoryChecks: readonly MandatoryCheckResult[];
  readonly crossPhaseChecks: readonly CrossPhaseCheckResult[];
  readonly actionItems: readonly ActionItem[];
}

export function calculateJudgment(
  totalScore: number,
  allPricesVerified: boolean,
  mandatoryFailures: number
): SubmissionJudgment {
  if (mandatoryFailures > 0) return '🔴';
  if (!allPricesVerified) return '🟡';
  if (totalScore >= 15) return '🟢';
  if (totalScore >= 10) return '🟡';
  return '🔴';
}
