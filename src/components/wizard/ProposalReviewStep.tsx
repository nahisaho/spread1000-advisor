'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { StreamingText, LoadingSpinner } from '@/components/common';
import { useLLMStream } from '@/hooks/useLLMStream';
import {
  REVIEW_CRITERION_LABELS,
  type CriterionScore,
  type ReviewCriterionId,
  type ScoreGrade,
} from '@/domain/values/ReviewScore';

interface ProposalReviewStepProps {
  projectId: string;
  onComplete: () => void;
}

const GRADE_STYLES: Record<ScoreGrade, string> = {
  '◎': 'bg-blue-100 text-blue-700',
  '○': 'bg-green-100 text-green-700',
  '△': 'bg-yellow-100 text-yellow-700',
  '×': 'bg-red-100 text-red-700',
};

interface ReviewApiResult {
  criteria: CriterionScore[];
  totalScore: number;
  actionItems: { priority: string; description: string; relatedSection: string }[];
}

export function ProposalReviewStep({ projectId, onComplete }: ProposalReviewStepProps) {
  const t = useTranslations();
  const [reviewResult, setReviewResult] = useState<ReviewApiResult | null>(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const { text, isStreaming, start } = useLLMStream();

  const handleStartReview = useCallback(() => {
    setReviewResult(null);
    start(`/api/projects/${encodeURIComponent(projectId)}/review`, { projectId });
  }, [projectId, start]);

  // Fetch structured result after streaming ends
  if (text && !isStreaming && !reviewResult && !isLoadingResult) {
    setIsLoadingResult(true);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/review/result`)
      .then((res) => res.json())
      .then((data: ReviewApiResult) => {
        setReviewResult(data);
        setIsLoadingResult(false);
      })
      .catch(() => setIsLoadingResult(false));
  }

  return (
    <div className="space-y-4" data-testid="proposal-review-step">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('wizard.steps.proposalReview')}
        </h2>
        <button
          type="button"
          onClick={handleStartReview}
          disabled={isStreaming}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="start-review-btn"
        >
          レビュー開始
        </button>
      </div>

      {isStreaming && <StreamingText text={text} isStreaming={isStreaming} />}

      {isLoadingResult && (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {reviewResult && (
        <>
          {/* Score table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200" data-testid="review-scores">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">評価項目</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">評価</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">点数</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">改善提案</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {reviewResult.criteria.map((score) => (
                  <tr key={score.criterionId}>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {REVIEW_CRITERION_LABELS[score.criterionId as ReviewCriterionId] ?? score.criterionName}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${GRADE_STYLES[score.grade]}`}
                      >
                        {score.grade}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-sm font-medium">{score.points}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{score.suggestion}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-4 py-2 text-sm font-semibold text-gray-900">合計</td>
                  <td />
                  <td className="px-4 py-2 text-center text-sm font-bold">{reviewResult.totalScore}/18</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action items */}
          {reviewResult.actionItems.length > 0 && (
            <div className="space-y-2" data-testid="action-items">
              <h3 className="text-sm font-semibold text-gray-700">改善提案</h3>
              <ul className="space-y-1">
                {reviewResult.actionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                        item.priority === 'High'
                          ? 'bg-red-100 text-red-700'
                          : item.priority === 'Medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.priority}
                    </span>
                    <span className="text-gray-700">{item.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
              data-testid="step-complete"
            >
              {t('wizard.actions.next')}
            </button>
          </div>
        </>
      )}

      {!isStreaming && !reviewResult && !isLoadingResult && (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-gray-400">
          「レビュー開始」ボタンを押して AI レビューを実行してください
        </div>
      )}
    </div>
  );
}
