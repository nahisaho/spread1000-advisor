export type ScoreGrade = '◎' | '○' | '△' | '×';

export const GRADE_POINTS: Record<ScoreGrade, number> = {
  '◎': 3, '○': 2, '△': 1, '×': 0,
};

export type ReviewCriterionId =
  | 'ai_validity'
  | 'research_track_record'
  | 'plan_budget_validity'
  | 'novelty_superiority'
  | 'knowhow_sharing'
  | 'impact_potential';

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
