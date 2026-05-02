'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { StreamingText } from '@/components/common';
import { MarkdownEditor, MarkdownPreview } from '@/components/editor';
import { StepConfirmation } from './StepConfirmation';
import { useLLMStream } from '@/hooks/useLLMStream';
import { useAutoSave } from '@/hooks/useAutoSave';

interface ResearchPlanStepProps {
  projectId: string;
  onComplete: () => void;
}

export function ResearchPlanStep({ projectId, onComplete }: ResearchPlanStepProps) {
  const t = useTranslations();
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { text, isStreaming, start, reset } = useLLMStream();

  const saveFn = useCallback(async () => {
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/deliverables`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'phase1-research-plan.md', content }),
    });
  }, [projectId, content]);

  const { saveStatus } = useAutoSave(saveFn, content);

  const displayContent = content || text;
  const hasContent = displayContent.trim().length > 0;

  const handleGenerate = useCallback(() => {
    reset();
    setContent('');
    setShowConfirmation(false);
    start('/api/llm/stream', {
      projectId,
      action: 'generate-research-plan',
      params: {},
    });
  }, [projectId, start, reset]);

  // Sync streamed text to content when streaming ends
  if (text && !isStreaming && !content) {
    setContent(text);
  }

  return (
    <div className="space-y-4" data-testid="research-plan-step">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('wizard.steps.researchPlan')}
        </h2>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="text-xs text-gray-400">{t('common.saving')}</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-600">{t('common.saved')}</span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isStreaming}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="generate-btn"
        >
          {hasContent ? t('wizard.actions.regenerate') : t('wizard.actions.generate')}
        </button>
        {hasContent && (
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            data-testid="edit-toggle"
          >
            {isEditing ? 'プレビュー' : '編集'}
          </button>
        )}
      </div>

      {isStreaming && <StreamingText text={text} isStreaming={isStreaming} />}

      {!isStreaming && hasContent && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {isEditing ? (
            <MarkdownEditor value={content} onChange={setContent} placeholder="研究プランを入力..." />
          ) : (
            <MarkdownPreview content={displayContent} />
          )}
        </div>
      )}

      {!isStreaming && !hasContent && (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-gray-400">
          「生成」ボタンを押して研究プランを作成してください
        </div>
      )}

      {hasContent && !isStreaming && !showConfirmation && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowConfirmation(true)}
            className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
            data-testid="step-complete"
          >
            内容を確認する
          </button>
        </div>
      )}

      {showConfirmation && (
        <StepConfirmation
          title="研究プランの確認"
          summary={`研究プランが生成されました（${content.split('\n').length}行）。\nこの内容で次のステップ（Azure構成設計）に進みますか？\n修正がある場合は「やり直す」を選択し、上の編集ボタンで修正してください。`}
          onConfirm={onComplete}
          onRevise={() => { setShowConfirmation(false); setIsEditing(true); }}
        />
      )}
    </div>
  );
}
