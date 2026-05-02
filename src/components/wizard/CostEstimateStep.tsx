'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingSpinner } from '@/components/common';
import { DIRECT_COST_LIMIT, type CostEstimate, type CostLineItem } from '@/domain/models/CostEstimate';

interface CostEstimateStepProps {
  projectId: string;
  onComplete: () => void;
}

function VerificationBadge({ status }: { status: CostLineItem['verificationStatus'] }) {
  if (status === 'api_verified') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        API検証済
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
      推定値
    </span>
  );
}

export function CostEstimateStep({ projectId, onComplete }: CostEstimateStepProps) {
  const t = useTranslations();
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleEstimate = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/llm/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'estimate-cost', params: {} }),
      });
      if (res.ok) {
        // Parse SSE stream for cost result
        const reader = res.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
          }
          // Extract content from SSE data lines
          for (const line of buffer.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const json = trimmed.slice(6);
              if (json === '[DONE]') break;
              try {
                const chunk = JSON.parse(json) as { content?: string; done?: boolean };
                if (chunk.content) {
                  const data = JSON.parse(chunk.content) as CostEstimate;
                  setEstimate(data);
                }
              } catch { /* skip malformed */ }
            }
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const exceedsBudget = estimate !== null && estimate.directCostTotal > DIRECT_COST_LIMIT;

  return (
    <div className="space-y-4" data-testid="cost-estimate-step">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('wizard.steps.costEstimate')}
        </h2>
        <button
          type="button"
          onClick={handleEstimate}
          disabled={isLoading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="estimate-btn"
        >
          コスト見積もり
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner label="見積もり中..." />
        </div>
      )}

      {estimate && !isLoading && (
        <>
          {/* Cost table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200" data-testid="cost-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">リソース</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">リージョン</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">数量</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">単価</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">月額</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">検証</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {estimate.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-900">{item.resourceName}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{item.sku}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{item.region}</td>
                    <td className="px-4 py-2 text-right text-sm text-gray-600">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-600">
                      ¥{item.unitPrice.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                      ¥{item.monthlyTotal.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <VerificationBadge status={item.verificationStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Budget summary */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2" data-testid="budget-summary">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">直接経費</span>
              <span className="font-medium">¥{estimate.directCostTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">間接経費（30%）</span>
              <span className="font-medium">¥{estimate.indirectCostTotal.toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-300 pt-2 flex justify-between text-base">
              <span className="font-semibold text-gray-900">合計</span>
              <span className="font-bold text-gray-900">¥{estimate.grandTotal.toLocaleString()}</span>
            </div>
            {exceedsBudget && (
              <p className="text-sm font-medium text-red-600" data-testid="budget-warning">
                ⚠️ 直接経費が上限（¥{DIRECT_COST_LIMIT.toLocaleString()}）を超えています
              </p>
            )}
          </div>

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

      {!estimate && !isLoading && (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-gray-400">
          「コスト見積もり」ボタンを押して見積もりを開始してください
        </div>
      )}
    </div>
  );
}
