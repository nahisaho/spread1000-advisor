'use client';

import { useCallback, useState } from 'react';
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

export function ContextCollectorStep({ projectId, onComplete }: ContextCollectorStepProps) {
  const t = useTranslations();
  const [metaPrompt, setMetaPrompt] = useState<MetaPrompt>(createEmptyMetaPrompt());
  const [input, setInput] = useState('');
  const { text, isStreaming, start } = useLLMStream();

  const currentKey = getNextQuestion(metaPrompt);
  const filledCount = META_PROMPT_KEYS.filter((k) => metaPrompt.elements[k].confirmed).length;
  const allConfirmed = isSufficient(metaPrompt);

  const handleSend = useCallback(() => {
    if (!input.trim() || !currentKey) return;

    setMetaPrompt((prev) => ({
      ...prev,
      elements: {
        ...prev.elements,
        [currentKey]: {
          key: currentKey,
          value: input.trim(),
          source: 'user' as const,
          confirmed: false,
        },
      },
    }));
    setInput('');

    start(`/api/projects/${encodeURIComponent(projectId)}/context`, {
      key: currentKey,
      answer: input.trim(),
    });
  }, [input, currentKey, projectId, start]);

  const handleConfirm = useCallback(
    (key: MetaPromptKey) => {
      setMetaPrompt((prev) => ({
        ...prev,
        elements: {
          ...prev.elements,
          [key]: { ...prev.elements[key], confirmed: true },
        },
      }));
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
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
          const isActive = key === currentKey;
          return (
            <div key={key} className="flex items-center gap-1">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  elem.confirmed
                    ? 'bg-green-100 text-green-700'
                    : isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {elem.confirmed ? '✓ ' : ''}
                {KEY_LABELS[key]}
              </span>
              {elem.value && !elem.confirmed && (
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

      {/* Chat area */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 min-h-[200px]">
        {text && <StreamingText text={text} isStreaming={isStreaming} />}
        {!text && currentKey && (
          <p className="text-gray-600">
            「{KEY_LABELS[currentKey]}」について教えてください。
          </p>
        )}
      </div>

      {/* Input */}
      {currentKey && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${KEY_LABELS[currentKey]}を入力...`}
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

      {/* Complete button */}
      {allConfirmed && (
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
      )}
    </div>
  );
}
