'use client';

import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import type { ChatMessage, RichContent } from '@/domain/models/ChatMessage';
import type { CostEstimate } from '@/domain/models/CostEstimate';
import { DIRECT_COST_LIMIT } from '@/domain/models/CostEstimate';
import type { MetaPrompt, MetaPromptKey } from '@/domain/models/MetaPrompt';
import { META_PROMPT_KEYS } from '@/domain/models/MetaPrompt';
import { REVIEW_CRITERION_LABELS, type ReviewCriterionId } from '@/domain/values/ReviewScore';
import type { ReviewScoresData, FinalCheckData } from '@/domain/models/ChatMessage';
import { useTranslations } from 'next-intl';

const KEY_LABELS: Record<MetaPromptKey, string> = {
  PURPOSE: '研究目的',
  TARGET: '対象領域',
  SCOPE: '研究範囲',
  TIMELINE: 'スケジュール',
  CONSTRAINTS: '制約条件',
  DELIVERABLES: '成果物',
};

interface ChatBubbleProps {
  message: ChatMessage;
  onAction?: (action: string, payload?: unknown) => void;
}

export function ChatBubble({ message, onAction }: ChatBubbleProps) {
  const { role, content, richContent, isStreaming } = message;

  if (richContent?.type === 'step-divider') {
    return (
      <div className="flex items-center gap-3 py-3" data-testid="step-divider">
        <div className="h-px flex-1 bg-gray-300" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          📋 {richContent.label}
        </span>
        <div className="h-px flex-1 bg-gray-300" />
      </div>
    );
  }

  if (role === 'system') {
    return (
      <div className="flex justify-center py-2" data-testid="system-message">
        <span className="rounded-full bg-gray-100 px-4 py-1.5 text-xs text-gray-600">
          {content}
        </span>
      </div>
    );
  }

  const isUser = role === 'user';

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      data-testid={`chat-bubble-${role}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
        }`}
      >
        {isUser ? '👤' : '🤖'}
      </div>

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white border border-gray-200 text-gray-900'
        }`}
      >
        {content && (
          <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : ''}`}>
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
          </div>
        )}

        {isStreaming && (
          <span
            className="inline-block h-4 w-0.5 animate-pulse bg-current align-text-bottom ml-0.5"
            aria-hidden="true"
          />
        )}

        {richContent && <RichContentRenderer rich={richContent} onAction={onAction} />}
      </div>
    </div>
  );
}

function RichContentRenderer({
  rich,
  onAction,
}: {
  rich: RichContent;
  onAction?: (action: string, payload?: unknown) => void;
}) {
  switch (rich.type) {
    case 'markdown':
      return (
        <div className="prose prose-sm max-w-none mt-2">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{rich.content}</ReactMarkdown>
        </div>
      );

    case 'meta-prompt-table':
      return <MetaPromptTable data={rich.data} onAction={onAction} />;

    case 'cost-table':
      return <CostTable data={rich.data} />;

    case 'review-scores':
      return <ReviewScoresTable data={rich.data} />;

    case 'final-check':
      return <FinalCheckDisplay data={rich.data} />;

    case 'action-buttons':
      return (
        <div className="flex flex-wrap gap-2 mt-3">
          {rich.buttons.map((btn) => (
            <button
              key={btn.action}
              type="button"
              onClick={() => onAction?.(btn.action)}
              disabled={btn.disabled}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                btn.variant === 'primary'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : btn.variant === 'danger'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      );

    case 'confirmation':
      return (
        <div className="mt-3 rounded-lg border-2 border-green-200 bg-green-50 p-3">
          <h4 className="text-sm font-bold text-green-900">{rich.title}</h4>
          <p className="text-xs text-green-700 mt-1 whitespace-pre-line">{rich.summary}</p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => onAction?.('confirm')}
              className="rounded-md bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              ✓ 確認して次へ
            </button>
            <button
              type="button"
              onClick={() => onAction?.('revise')}
              className="rounded-md border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              ↻ やり直す
            </button>
          </div>
        </div>
      );

    case 'download-links':
      return <DownloadLinks projectId={rich.projectId} />;

    default:
      return null;
  }
}

function MetaPromptTable({
  data,
  onAction,
}: {
  data: MetaPrompt;
  onAction?: (action: string, payload?: unknown) => void;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" data-testid="meta-prompt-table">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-600">要素</th>
            <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-600">内容</th>
            <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-600 w-16">ソース</th>
          </tr>
        </thead>
        <tbody>
          {META_PROMPT_KEYS.map((key) => {
            const elem = data.elements[key];
            return (
              <tr key={key} className="border-b border-gray-100">
                <td className="py-1.5 px-2 text-xs font-medium text-gray-800">{KEY_LABELS[key]}</td>
                <td className="py-1.5 px-2 text-xs text-gray-700">{elem.value ?? '（未入力）'}</td>
                <td className="py-1.5 px-2">
                  <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    elem.source === 'user' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {elem.source === 'user' ? '手入力' : 'AI推定'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {onAction && (
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => onAction('approve-meta')}
            className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
            data-testid="meta-prompt-approve"
          >
            ✓ この内容で進める
          </button>
          <button
            type="button"
            onClick={() => onAction('edit-meta')}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            ✏️ 修正する
          </button>
        </div>
      )}
    </div>
  );
}

function CostTable({ data }: { data: CostEstimate }) {
  const exceedsBudget = data.directCostTotal > DIRECT_COST_LIMIT;
  return (
    <div className="mt-3 space-y-2">
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-xs" data-testid="cost-table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-gray-500">リソース</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-500">SKU</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-500">月額</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.items.map((item, idx) => (
              <tr key={idx}>
                <td className="px-2 py-1.5 text-gray-900">{item.resourceName}</td>
                <td className="px-2 py-1.5 text-gray-600">{item.sku}</td>
                <td className="px-2 py-1.5 text-right font-medium">¥{item.monthlyTotal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs space-y-1">
        <div className="flex justify-between"><span>直接経費</span><span className="font-medium">¥{data.directCostTotal.toLocaleString()}</span></div>
        <div className="flex justify-between"><span>間接経費（30%）</span><span className="font-medium">¥{data.indirectCostTotal.toLocaleString()}</span></div>
        <div className="border-t border-gray-300 pt-1 flex justify-between font-semibold">
          <span>合計</span><span>¥{data.grandTotal.toLocaleString()}</span>
        </div>
        {exceedsBudget && (
          <p className="text-red-600 font-medium">⚠️ 直接経費が上限（¥{DIRECT_COST_LIMIT.toLocaleString()}）を超えています</p>
        )}
      </div>
    </div>
  );
}

function ReviewScoresTable({ data }: { data: ReviewScoresData }) {
  const GRADE_STYLES: Record<string, string> = {
    '◎': 'bg-blue-100 text-blue-700',
    '○': 'bg-green-100 text-green-700',
    '△': 'bg-yellow-100 text-yellow-700',
    '×': 'bg-red-100 text-red-700',
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-xs" data-testid="review-scores">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-gray-500">評価項目</th>
              <th className="px-2 py-1.5 text-center font-medium text-gray-500">評価</th>
              <th className="px-2 py-1.5 text-center font-medium text-gray-500">点数</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-500">改善提案</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.criteria.map((score) => (
              <tr key={score.criterionId}>
                <td className="px-2 py-1.5 text-gray-900">
                  {REVIEW_CRITERION_LABELS[score.criterionId as ReviewCriterionId] ?? score.criterionName}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${GRADE_STYLES[score.grade] ?? ''}`}>
                    {score.grade}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center font-medium">{score.points}</td>
                <td className="px-2 py-1.5 text-gray-600">{score.suggestion}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td className="px-2 py-1.5 font-semibold">合計</td>
              <td />
              <td className="px-2 py-1.5 text-center font-bold">{data.totalScore}/18</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {data.actionItems.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-gray-700">改善提案</h4>
          <ul className="space-y-0.5">
            {data.actionItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-xs">
                <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${
                  item.priority === 'High' ? 'bg-red-100 text-red-700' :
                  item.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{item.priority}</span>
                <span className="text-gray-700">{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FinalCheckDisplay({ data }: { data: FinalCheckData }) {
  const JUDGMENT_STYLES: Record<string, { bg: string; label: string }> = {
    '🟢': { bg: 'bg-green-100 border-green-300', label: '提出推奨' },
    '🟡': { bg: 'bg-yellow-100 border-yellow-300', label: '要修正' },
    '🔴': { bg: 'bg-red-100 border-red-300', label: '大幅見直し' },
  };
  const style = JUDGMENT_STYLES[data.judgment] ?? { bg: 'bg-gray-100 border-gray-300', label: '' };

  return (
    <div className="mt-3 space-y-2">
      <div className={`flex items-center gap-2 rounded-lg border-2 p-3 ${style.bg}`}>
        <span className="text-3xl">{data.judgment}</span>
        <span className="text-sm font-bold text-gray-900">{style.label}</span>
      </div>
      <div className="rounded border border-gray-200 divide-y divide-gray-200">
        {data.mandatoryChecks.map((check) => (
          <div key={check.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
            <span className="text-gray-700">{check.label}</span>
            <span className={check.passed ? 'text-green-600' : 'text-red-600'}>{check.passed ? '✓' : '✗'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DownloadLinks({ projectId }: { projectId: string }) {
  const t = useTranslations();
  return (
    <div className="flex flex-wrap gap-2 mt-3" data-testid="download-buttons">
      <a href={`/api/export/${encodeURIComponent(projectId)}/markdown`} download
        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
        📄 {t('export.markdown')}
      </a>
      <a href={`/api/export/${encodeURIComponent(projectId)}/xlsx`} download
        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
        📊 {t('export.excel')}
      </a>
      <a href={`/api/export/${encodeURIComponent(projectId)}/zip`} download
        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
        📦 {t('export.zip')}
      </a>
    </div>
  );
}
