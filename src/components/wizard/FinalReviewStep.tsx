'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingSpinner } from '@/components/common';
import type { SubmissionJudgment } from '@/domain/values/ReviewScore';
import type { MandatoryCheckResult, CrossPhaseCheckResult } from '@/domain/values/MandatoryChecks';

interface FinalReviewStepProps {
  projectId: string;
}

interface FinalCheckResult {
  mandatoryChecks: MandatoryCheckResult[];
  crossPhaseChecks: CrossPhaseCheckResult[];
  judgment: SubmissionJudgment;
}

const JUDGMENT_STYLES: Record<SubmissionJudgment, { bg: string; label: string }> = {
  '🟢': { bg: 'bg-green-100 border-green-300', label: '提出推奨' },
  '🟡': { bg: 'bg-yellow-100 border-yellow-300', label: '要修正' },
  '🔴': { bg: 'bg-red-100 border-red-300', label: '大幅見直し' },
};

export function FinalReviewStep({ projectId }: FinalReviewStepProps) {
  const t = useTranslations();
  const [result, setResult] = useState<FinalCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRunChecks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/final-review`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = (await res.json()) as FinalCheckResult;
        setResult(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  return (
    <div className="space-y-6" data-testid="final-review-step">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('wizard.steps.finalReview')}
        </h2>
        <button
          type="button"
          onClick={handleRunChecks}
          disabled={isLoading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="run-checks-btn"
        >
          最終チェック実行
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner label="チェック実行中..." />
        </div>
      )}

      {result && !isLoading && (
        <>
          {/* Judgment display */}
          <div
            className={`flex flex-col items-center gap-2 rounded-lg border-2 p-8 ${JUDGMENT_STYLES[result.judgment].bg}`}
            data-testid="judgment-display"
          >
            <span className="text-6xl">{result.judgment}</span>
            <span className="text-lg font-bold text-gray-900">
              {JUDGMENT_STYLES[result.judgment].label}
            </span>
          </div>

          {/* Mandatory checks */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">必須チェック項目</h3>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-200" data-testid="mandatory-checks">
              {result.mandatoryChecks.map((check) => (
                <div key={check.id} className="flex items-center justify-between px-4 py-2">
                  <span className="text-sm text-gray-700">{check.label}</span>
                  <span className={`text-lg ${check.passed ? 'text-green-600' : 'text-red-600'}`}>
                    {check.passed ? '✓' : '✗'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cross-phase checks */}
          {result.crossPhaseChecks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">クロスフェーズチェック</h3>
              <div className="rounded-lg border border-gray-200 divide-y divide-gray-200" data-testid="cross-phase-checks">
                {result.crossPhaseChecks.map((check) => (
                  <div key={check.id} className="flex items-center justify-between px-4 py-2">
                    <div>
                      <span className="text-sm text-gray-700">{check.label}</span>
                      {check.detail && (
                        <p className="text-xs text-gray-500">{check.detail}</p>
                      )}
                    </div>
                    <span className={`text-lg ${check.passed ? 'text-green-600' : 'text-red-600'}`}>
                      {check.passed ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Download buttons */}
          <div className="flex flex-wrap gap-3" data-testid="download-buttons">
            <a
              href={`/api/export/${encodeURIComponent(projectId)}/markdown`}
              download
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              data-testid="download-md"
            >
              📄 {t('export.markdown')}
            </a>
            <a
              href={`/api/export/${encodeURIComponent(projectId)}/xlsx`}
              download
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              data-testid="download-excel"
            >
              📊 {t('export.excel')}
            </a>
            <a
              href={`/api/export/${encodeURIComponent(projectId)}/zip`}
              download
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              data-testid="download-zip"
            >
              📦 {t('export.zip')}
            </a>
          </div>
        </>
      )}

      {!result && !isLoading && (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-gray-400">
          「最終チェック実行」ボタンを押して最終判定を行ってください
        </div>
      )}
    </div>
  );
}
