'use client';

import { useCallback, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { StreamingText } from '@/components/common';
import { useLLMStream } from '@/hooks/useLLMStream';
import {
  META_PROMPT_KEYS,
  getNextQuestion,
  isSufficient,
  createEmptyMetaPrompt,
  type MetaPrompt,
  type MetaPromptKey,
} from '@/domain/models/MetaPrompt';

interface ContextCollectorStepProps {
  projectId: string;
  onComplete: () => void;
}

const KEY_LABELS: Record<MetaPromptKey, string> = {
  PURPOSE: '研究目的',
  TARGET: '対象領域',
  SCOPE: '研究範囲',
  TIMELINE: 'スケジュール',
  CONSTRAINTS: '制約条件',
  DELIVERABLES: '成果物',
};

type Phase = 'initial' | 'analyzing' | 'questioning' | 'reviewing' | 'approved';

export function ContextCollectorStep({ projectId, onComplete }: ContextCollectorStepProps) {
  const t = useTranslations();
  const [phase, setPhase] = useState<Phase>('initial');
  const [metaPrompt, setMetaPrompt] = useState<MetaPrompt>(createEmptyMetaPrompt());
  const [input, setInput] = useState('');
  const [editingKey, setEditingKey] = useState<MetaPromptKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const { text, isStreaming, start, reset } = useLLMStream();
  const inputRef = useRef<HTMLInputElement>(null);

  const currentKey = getNextQuestion(metaPrompt);
  const filledCount = META_PROMPT_KEYS.filter((k) => metaPrompt.elements[k].confirmed).length;
  const allConfirmed = isSufficient(metaPrompt);

  // Phase: initial — submit free-text for AI analysis
  const handleInitialSubmit = useCallback(async () => {
    if (!input.trim()) return;
    setPhase('analyzing');
    const userInput = input.trim();
    setInput('');

    try {
      const res = await fetch('/api/llm/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'analyze-context',
          params: { userInput },
        }),
      });

      if (!res.ok || !res.body) {
        setPhase('questioning');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      // Parse SSE data
      const lines = fullText.split('\n').filter((l) => l.startsWith('data: '));
      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6)) as { content?: string; done?: boolean };
          if (data.content && !data.done) {
            const parsed = JSON.parse(data.content) as { elements: MetaPrompt['elements'] };
            if (parsed.elements) {
              setMetaPrompt(parsed as MetaPrompt);
              // If all have values (even unconfirmed), go to review
              const hasValues = META_PROMPT_KEYS.every(
                (k) => parsed.elements[k]?.value !== null && parsed.elements[k]?.value !== undefined,
              );
              setPhase(hasValues ? 'reviewing' : 'questioning');
              return;
            }
          }
        } catch {
          // continue parsing
        }
      }
      setPhase('questioning');
    } catch {
      setPhase('questioning');
    }
  }, [input, projectId]);

  // Phase: questioning — send answer for current key
  const handleSend = useCallback(() => {
    if (!input.trim() || !currentKey) return;

    const answer = input.trim();
    const isUnknown = /^(わからない|不明|未定|分からない)$/i.test(answer);

    if (isUnknown) {
      // Ask AI to propose an estimate
      setInput('');
      start('/api/llm/stream', {
        projectId,
        action: 'estimate-context',
        params: { key: currentKey, metaPrompt },
      });
      return;
    }

    setMetaPrompt((prev) => ({
      ...prev,
      elements: {
        ...prev.elements,
        [currentKey]: {
          key: currentKey,
          value: answer,
          source: 'user' as const,
          confirmed: true,
        },
      },
    }));
    setInput('');
    reset();

    // Check if all are now confirmed — go to review
    const updatedElements = {
      ...metaPrompt.elements,
      [currentKey]: { key: currentKey, value: answer, source: 'user' as const, confirmed: true },
    };
    const allDone = META_PROMPT_KEYS.every((k) => updatedElements[k]?.confirmed);
    if (allDone) {
      setPhase('reviewing');
    } else {
      // Trigger next question
      const nextMeta = { ...metaPrompt, elements: updatedElements };
      start('/api/llm/stream', {
        projectId,
        action: 'collect-context',
        params: { metaPrompt: nextMeta },
      });
    }
  }, [input, currentKey, projectId, start, reset, metaPrompt]);

  // Confirm an auto-filled element
  const handleConfirm = useCallback((key: MetaPromptKey) => {
    setMetaPrompt((prev) => {
      const updated = {
        ...prev,
        elements: {
          ...prev.elements,
          [key]: { ...prev.elements[key], confirmed: true },
        },
      };
      // Check if all confirmed → go to review
      const allDone = META_PROMPT_KEYS.every((k) => updated.elements[k]?.confirmed);
      if (allDone) {
        setPhase('reviewing');
      }
      return updated;
    });
  }, []);

  // Edit a specific element in review phase
  const handleStartEdit = useCallback((key: MetaPromptKey) => {
    setEditingKey(key);
    setEditValue(metaPrompt.elements[key].value ?? '');
  }, [metaPrompt]);

  const handleSaveEdit = useCallback(() => {
    if (!editingKey || !editValue.trim()) return;
    setMetaPrompt((prev) => ({
      ...prev,
      elements: {
        ...prev.elements,
        [editingKey]: {
          key: editingKey,
          value: editValue.trim(),
          source: 'user' as const,
          confirmed: true,
        },
      },
    }));
    setEditingKey(null);
    setEditValue('');
  }, [editingKey, editValue]);

  // Approve meta-prompt
  const handleApprove = useCallback(() => {
    setMetaPrompt((prev) => ({ ...prev, approved: true }));
    setPhase('approved');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (phase === 'initial') {
          handleInitialSubmit();
        } else {
          handleSend();
        }
      }
    },
    [phase, handleInitialSubmit, handleSend],
  );

  return (
    <div className="space-y-6" data-testid="context-collector-step">
      {/* Progress */}
      <div className="flex items-center gap-2" data-testid="context-progress">
        <span className="text-sm font-medium text-gray-700">
          進捗: {filledCount} / {META_PROMPT_KEYS.length}
        </span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all"
            style={{ width: `${(filledCount / META_PROMPT_KEYS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Element badges */}
      <div className="flex flex-wrap gap-2">
        {META_PROMPT_KEYS.map((key) => {
          const elem = metaPrompt.elements[key];
          const isActive = key === currentKey && phase === 'questioning';
          return (
            <div key={key} className="flex items-center gap-1">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  elem.confirmed
                    ? 'bg-green-100 text-green-700'
                    : elem.value
                      ? 'bg-yellow-100 text-yellow-700'
                      : isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                }`}
              >
                {elem.confirmed ? '✓ ' : elem.value ? '● ' : ''}
                {KEY_LABELS[key]}
              </span>
              {elem.value && !elem.confirmed && phase === 'questioning' && (
                <button
                  type="button"
                  onClick={() => handleConfirm(key)}
                  className="rounded bg-green-600 px-2 py-0.5 text-xs text-white hover:bg-green-700"
                  data-testid={`confirm-${key}`}
                >
                  確認
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Phase: initial — free text input */}
      {phase === 'initial' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="text-sm font-bold text-blue-900 mb-2">
              📝 研究の概要を教えてください
            </h3>
            <p className="text-sm text-blue-700">
              AIが内容を解析し、申請書作成に必要な情報を自動抽出します。
              不足している情報は1問ずつ質問します。
            </p>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例: 無機固体材料の探索をAIで加速したい。機械学習ポテンシャルを使って第一原理計算を高速化し、新規材料候補を網羅的にスクリーニングする研究を計画しています..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[120px] resize-y"
            data-testid="initial-input"
          />
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => { setPhase('questioning'); }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              スキップして1問ずつ回答する
            </button>
            <button
              type="button"
              onClick={handleInitialSubmit}
              disabled={!input.trim()}
              className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="initial-submit"
            >
              AIで解析する
            </button>
          </div>
        </div>
      )}

      {/* Phase: analyzing */}
      {phase === 'analyzing' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="h-8 w-8 border-3 animate-spin rounded-full border-blue-600 border-t-transparent" />
          <span className="text-sm text-gray-600">入力内容を解析中...</span>
        </div>
      )}

      {/* Phase: questioning — chat area */}
      {phase === 'questioning' && (
        <>
          <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 min-h-[200px]">
            {text && <StreamingText text={text} isStreaming={isStreaming} />}
            {!text && currentKey && (
              <p className="text-gray-600">
                「{KEY_LABELS[currentKey]}」について教えてください。
              </p>
            )}
          </div>

          {currentKey && (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`${KEY_LABELS[currentKey]}を入力...（「わからない」と答えるとAIが推定します）`}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                data-testid="context-input"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="context-send"
              >
                送信
              </button>
            </div>
          )}

          {!currentKey && !allConfirmed && (
            <p className="text-sm text-gray-500">
              自動抽出された要素を確認してください。各要素の「確認」ボタンを押してください。
            </p>
          )}

          {allConfirmed && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPhase('reviewing')}
                className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                確認画面へ
              </button>
            </div>
          )}
        </>
      )}

      {/* Phase: reviewing — meta-prompt summary */}
      {phase === 'reviewing' && (
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
            <h3 className="text-lg font-bold text-blue-900 mb-3">
              📋 構造化メタプロンプト
            </h3>
            <p className="text-sm text-blue-700 mb-4">
              以下の内容で研究プラン策定を進めます。修正が必要な場合は「編集」をクリックしてください。
            </p>
          </div>

          <table className="w-full border-collapse" data-testid="meta-prompt-table">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 w-1/4">要素</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">内容</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 w-20">ソース</th>
                <th className="py-2 px-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {META_PROMPT_KEYS.map((key) => {
                const elem = metaPrompt.elements[key];
                const isEditing = editingKey === key;
                return (
                  <tr key={key} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-sm font-medium text-gray-900">
                      {KEY_LABELS[key]}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-700">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                            data-testid={`edit-input-${key}`}
                          />
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingKey(null)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        elem.value ?? '（未入力）'
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          elem.source === 'user'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {elem.source === 'user' ? '手入力' : 'AI推定'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(key)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                          data-testid={`edit-${key}`}
                        >
                          編集
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPhase('questioning')}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ↻ 質問に戻る
            </button>
            <button
              type="button"
              onClick={handleApprove}
              className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
              data-testid="meta-prompt-approve"
            >
              ✓ この内容で進める
            </button>
          </div>
        </div>
      )}

      {/* Phase: approved */}
      {phase === 'approved' && (
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
            <h3 className="text-lg font-bold text-green-900">✅ メタプロンプト承認済み</h3>
            <p className="text-sm text-green-700 mt-1">次のステップに進めます。</p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
              data-testid="context-complete"
            >
              {t('wizard.actions.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
