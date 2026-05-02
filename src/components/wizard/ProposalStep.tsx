'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { StreamingText } from '@/components/common';
import { CharacterCounter, MarkdownEditor } from '@/components/editor';
import { StepConfirmation } from './StepConfirmation';
import { useLLMStream } from '@/hooks/useLLMStream';
import { useAutoSave } from '@/hooks/useAutoSave';
import { SECTION_CHAR_LIMITS, type ProposalSectionId } from '@/domain/models/Proposal';

interface ProposalStepProps {
  projectId: string;
  onComplete: () => void;
}

const SECTION_ORDER: ProposalSectionId[] = [
  'research_purpose',
  'research_method',
  'ai_validity',
  'achievement_goals',
  'knowhow_sharing',
  'research_achievements',
  'expense_plan',
];

const SECTION_LABELS: Record<ProposalSectionId, string> = {
  research_purpose: '研究目的',
  research_method: '研究手法',
  ai_validity: 'AI活用の妥当性',
  achievement_goals: '達成目標',
  knowhow_sharing: 'ノウハウ共有',
  research_achievements: '研究実績',
  expense_plan: '経費計画',
};

export function ProposalStep({ projectId, onComplete }: ProposalStepProps) {
  const t = useTranslations();
  const [sections, setSections] = useState<Record<ProposalSectionId, string>>(
    () => Object.fromEntries(SECTION_ORDER.map((id) => [id, ''])) as Record<ProposalSectionId, string>,
  );
  const [activeSection, setActiveSection] = useState<ProposalSectionId>('research_purpose');
  const [generatingSection, setGeneratingSection] = useState<ProposalSectionId | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const { text, isStreaming, start, reset } = useLLMStream();

  const saveFn = useCallback(async () => {
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/deliverables`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'phase3-proposal.md', content: JSON.stringify(sections) }),
    });
  }, [projectId, sections]);

  const { saveStatus } = useAutoSave(saveFn, sections);

  const handleSectionChange = useCallback((id: ProposalSectionId, value: string) => {
    setSections((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleGenerate = useCallback(
    (sectionId: ProposalSectionId) => {
      reset();
      setGeneratingSection(sectionId);
      start('/api/llm/stream', {
        projectId,
        action: 'generate-proposal',
        params: { sectionId },
      });
    },
    [projectId, start, reset],
  );

  // Sync generated text to section when streaming ends
  if (generatingSection && text && !isStreaming) {
    setSections((prev) => ({ ...prev, [generatingSection]: text }));
    setGeneratingSection(null);
  }

  const limits = SECTION_CHAR_LIMITS[activeSection];

  return (
    <div className="space-y-4" data-testid="proposal-step">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('wizard.steps.proposal')}
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

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-2" data-testid="section-tabs">
        {SECTION_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSection(id)}
            className={`rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeSection === id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid={`tab-${id}`}
          >
            {SECTION_LABELS[id]}
          </button>
        ))}
      </div>

      {/* Active section editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">{SECTION_LABELS[activeSection]}</h3>
          <div className="flex items-center gap-3">
            <CharacterCounter
              current={sections[activeSection].length}
              min={limits.min}
              max={limits.max}
            />
            <button
              type="button"
              onClick={() => handleGenerate(activeSection)}
              disabled={isStreaming}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="generate-section-btn"
            >
              {t('wizard.actions.generate')}
            </button>
          </div>
        </div>

        {isStreaming && generatingSection === activeSection ? (
          <StreamingText text={text} isStreaming={isStreaming} />
        ) : (
          <MarkdownEditor
            value={sections[activeSection]}
            onChange={(v) => handleSectionChange(activeSection, v)}
            placeholder={`${SECTION_LABELS[activeSection]}を入力...`}
          />
        )}
      </div>

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

      {showConfirmation && (
        <StepConfirmation
          title="申請書の確認"
          summary="申請書の全セクションが作成されました。\nこの内容で次のステップ（レビュー）に進みますか？"
          onConfirm={onComplete}
          onRevise={() => setShowConfirmation(false)}
        />
      )}
    </div>
  );
}
