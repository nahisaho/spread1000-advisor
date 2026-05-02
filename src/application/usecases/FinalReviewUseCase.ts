import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { Proposal } from '@/domain/models/Proposal';
import type { CostEstimate } from '@/domain/models/CostEstimate';
import { validateBudget } from '@/domain/models/CostEstimate';
import {
  runMandatoryChecks,
  runCrossPhaseChecks,
  type MandatoryCheckResult,
  type CrossPhaseCheckResult,
} from '@/domain/values/MandatoryChecks';
import { calculateJudgment, type SubmissionJudgment } from '@/domain/values/ReviewScore';
import { appendDisclaimer } from '@/lib/disclaimer';

export interface FinalReviewResult {
  readonly mandatoryChecks: MandatoryCheckResult[];
  readonly crossPhaseChecks: CrossPhaseCheckResult[];
  readonly judgment: SubmissionJudgment;
  readonly totalScore: number;
}

function formatFinalReviewMarkdown(result: FinalReviewResult): string {
  const lines: string[] = [
    '# 最終レビュー結果',
    '',
    '## 必須チェック',
    '',
    '| チェック項目 | 結果 | 詳細 |',
    '|-------------|------|------|',
  ];

  for (const check of result.mandatoryChecks) {
    lines.push(
      `| ${check.label} | ${check.passed ? '✅' : '❌'} | ${check.detail ?? '-'} |`,
    );
  }

  lines.push(
    '',
    '## クロスフェーズチェック',
    '',
    '| チェック項目 | 結果 | 詳細 |',
    '|-------------|------|------|',
  );

  for (const check of result.crossPhaseChecks) {
    lines.push(
      `| ${check.label} | ${check.passed ? '✅' : '❌'} | ${check.detail ?? '-'} |`,
    );
  }

  lines.push(
    '',
    `## 総合判定: ${result.judgment}`,
    '',
    `スコア: ${result.totalScore} / 18`,
  );

  return lines.join('\n');
}

export class FinalReviewUseCase {
  constructor(
    private readonly projectRepo: IProjectRepository,
  ) {}

  async execute(
    projectId: string,
    proposal: Proposal,
    costEstimate: CostEstimate,
  ): Promise<FinalReviewResult> {
    const mandatoryChecks = runMandatoryChecks(proposal, costEstimate);
    const crossPhaseChecks = runCrossPhaseChecks(proposal, costEstimate);

    const mandatoryFailures = mandatoryChecks.filter((c) => !c.passed).length;
    const budget = validateBudget(costEstimate);

    // totalScore=0 is a placeholder; actual score comes from LLM review
    const result: FinalReviewResult = {
      mandatoryChecks,
      crossPhaseChecks,
      judgment: calculateJudgment(0, budget.allPricesVerified, mandatoryFailures),
      totalScore: 0,
    };

    const markdown = formatFinalReviewMarkdown(result);
    await this.projectRepo.saveDeliverable(
      projectId,
      'final-review-report.md',
      appendDisclaimer(markdown),
    );

    return result;
  }
}
