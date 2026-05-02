'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatInput } from '@/components/chat/ChatInput';
import { useChatMessages } from '@/hooks/useChatMessages';
import { StepId, STEP_ORDER, StepStatus } from '@/domain/models/WizardStep';
import type { WizardState } from '@/domain/models/WizardStep';
import type { MetaPrompt, MetaPromptKey } from '@/domain/models/MetaPrompt';
import {
  META_PROMPT_KEYS,
  getNextQuestion,
  isSufficient,
  createEmptyMetaPrompt,
} from '@/domain/models/MetaPrompt';
import type { CostEstimate } from '@/domain/models/CostEstimate';
import type { ActionButton, ReviewScoresData, FinalCheckData } from '@/domain/models/ChatMessage';
import type { ProposalSectionId } from '@/domain/models/Proposal';

const STEP_LABELS: Record<StepId, string> = {
  [StepId.CONTEXT_COLLECTION]: 'コンテキスト収集',
  [StepId.RESEARCH_PLAN]: '研究プラン策定',
  [StepId.AZURE_ARCHITECTURE]: 'Azure構成設計',
  [StepId.COST_ESTIMATE]: 'コスト見積もり',
  [StepId.PROPOSAL]: '申請書作成',
  [StepId.PROPOSAL_REVIEW]: '申請書レビュー',
  [StepId.FINAL_REVIEW]: '最終チェック',
};

const SECTION_LABELS: Record<string, string> = {
  research_purpose: '研究目的',
  research_method: '研究手法',
  ai_validity: 'AI活用の妥当性',
  achievement_goals: '達成目標',
  knowhow_sharing: 'ノウハウ共有',
  research_achievements: '研究実績',
  expense_plan: '経費計画',
};

const SECTION_ORDER: ProposalSectionId[] = [
  'research_purpose', 'research_method', 'ai_validity', 'achievement_goals',
  'knowhow_sharing', 'research_achievements', 'expense_plan',
];

interface ChatStepControllerProps {
  projectId: string;
  wizardState: WizardState;
  onStepComplete: (stepId: StepId) => void;
  onStepChange: (stepId: StepId) => void;
}

type StepPhase =
  | 'idle'
  | 'context-initial'
  | 'context-analyzing'
  | 'context-questioning'
  | 'context-reviewing'
  | 'generating'
  | 'confirming'
  | 'streaming';

export function ChatStepController({
  projectId,
  wizardState,
  onStepComplete,
  onStepChange,
}: ChatStepControllerProps) {
  const t = useTranslations();
  const chat = useChatMessages();
  const [currentStep, setCurrentStep] = useState<StepId>(wizardState.currentStep);
  const [stepPhase, setStepPhase] = useState<StepPhase>('idle');
  const [isStreaming, setIsStreaming] = useState(false);
  const [metaPrompt, setMetaPrompt] = useState<MetaPrompt>(createEmptyMetaPrompt());
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [proposalSections, setProposalSections] = useState<Record<string, string>>({});
  const [currentProposalSection, setCurrentProposalSection] = useState<ProposalSectionId>('research_purpose');
  const streamingMsgIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Initialize first step on mount
  if (!initializedRef.current) {
    initializedRef.current = true;
    initializeStep(currentStep);
  }

  function initializeStep(stepId: StepId) {
    chat.addStepDivider(stepId, STEP_LABELS[stepId]);

    switch (stepId) {
      case StepId.CONTEXT_COLLECTION:
        chat.addAssistantMessage(
          '📝 研究の概要を教えてください。\n\nAIが内容を解析し、申請書作成に必要な情報（研究目的・対象領域・研究範囲・スケジュール・制約条件・成果物）を自動抽出します。\n\n不足している情報は1問ずつ質問します。',
          { stepId },
        );
        setStepPhase('context-initial');
        break;

      case StepId.RESEARCH_PLAN:
        chat.addAssistantMessage(
          '📋 研究プランを生成します。コンテキスト情報を基にAIが研究プランを策定します。\n\n「生成」ボタンを押してください。',
          { stepId },
        );
        setStepPhase('idle');
        break;

      case StepId.AZURE_ARCHITECTURE:
        chat.addAssistantMessage(
          '☁️ Azure構成を設計します。研究プランを基にAIが最適なAzure構成を提案します。\n\n「生成」ボタンを押してください。',
          { stepId },
        );
        setStepPhase('idle');
        break;

      case StepId.COST_ESTIMATE:
        chat.addAssistantMessage(
          '💰 コスト見積もりを作成します。Azure構成を基にAIがコストを算出します。\n\n「見積もり」ボタンを押してください。',
          { stepId },
        );
        setStepPhase('idle');
        break;

      case StepId.PROPOSAL:
        chat.addAssistantMessage(
          '📄 申請書を作成します。セクションごとにAIが文章を生成します。\n\n「生成」ボタンで各セクションを作成してください。',
          { stepId },
        );
        setStepPhase('idle');
        break;

      case StepId.PROPOSAL_REVIEW:
        chat.addAssistantMessage(
          '🔍 申請書のAIレビューを実行します。\n\n「レビュー開始」ボタンを押してください。',
          { stepId },
        );
        setStepPhase('idle');
        break;

      case StepId.FINAL_REVIEW:
        chat.addAssistantMessage(
          '✅ 最終チェックを実行します。\n\n「最終チェック」ボタンを押してください。',
          { stepId },
        );
        setStepPhase('idle');
        break;
    }
  }

  function advanceToNextStep() {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx < STEP_ORDER.length - 1) {
      const nextStep = STEP_ORDER[idx + 1];
      onStepComplete(currentStep);
      setCurrentStep(nextStep);
      onStepChange(nextStep);
      initializeStep(nextStep);
    }
  }

  // SSE stream helper
  async function streamFromAPI(
    action: string,
    params: Record<string, unknown>,
    onChunk: (chunk: string) => void,
    onDone: (fullText: string) => void,
  ) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    try {
      const res = await fetch('/api/llm/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action, params }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') break;

          try {
            const chunk = JSON.parse(jsonStr) as { content?: string; done?: boolean };
            if (chunk.content) {
              fullText += chunk.content;
              onChunk(chunk.content);
            }
            if (chunk.done) break;
          } catch { /* skip */ }
        }
      }

      setIsStreaming(false);
      onDone(fullText);
    } catch (err) {
      if (!(err instanceof DOMException && (err as DOMException).name === 'AbortError')) {
        chat.addAssistantMessage('⚠️ エラーが発生しました。もう一度お試しください。', { stepId: currentStep });
      }
      setIsStreaming(false);
    }
  }

  // --- Context Collection handlers ---
  const handleContextInitialSubmit = useCallback(async (userInput: string) => {
    chat.addUserMessage(userInput, StepId.CONTEXT_COLLECTION);
    setStepPhase('context-analyzing');
    chat.addAssistantMessage('入力内容を解析中...', { stepId: StepId.CONTEXT_COLLECTION });

    try {
      const res = await fetch('/api/llm/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'analyze-context', params: { userInput } }),
      });

      if (!res.ok || !res.body) {
        setStepPhase('context-questioning');
        askNextQuestion(metaPrompt);
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

      const lines = fullText.split('\n').filter((l) => l.startsWith('data: '));
      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6)) as { content?: string; done?: boolean };
          if (data.content && !data.done) {
            const parsed = JSON.parse(data.content) as { elements: MetaPrompt['elements'] };
            if (parsed.elements) {
              const newMeta = parsed as MetaPrompt;
              setMetaPrompt(newMeta);

              const hasValues = META_PROMPT_KEYS.every(
                (k) => parsed.elements[k]?.value !== null && parsed.elements[k]?.value !== undefined,
              );

              if (hasValues) {
                chat.addAssistantMessage('解析完了。以下の情報を抽出しました：', {
                  richContent: { type: 'meta-prompt-table', data: newMeta },
                  stepId: StepId.CONTEXT_COLLECTION,
                });
                setStepPhase('context-reviewing');
                return;
              }

              chat.addAssistantMessage('一部の情報を抽出しました。不足項目を質問します。', {
                stepId: StepId.CONTEXT_COLLECTION,
              });
              setStepPhase('context-questioning');
              askNextQuestion(newMeta);
              return;
            }
          }
        } catch { /* continue */ }
      }
      setStepPhase('context-questioning');
      askNextQuestion(metaPrompt);
    } catch {
      setStepPhase('context-questioning');
      askNextQuestion(metaPrompt);
    }
  }, [projectId, metaPrompt]);

  function askNextQuestion(mp: MetaPrompt) {
    const KEY_LABELS: Record<MetaPromptKey, string> = {
      PURPOSE: '研究目的', TARGET: '対象領域', SCOPE: '研究範囲',
      TIMELINE: 'スケジュール', CONSTRAINTS: '制約条件', DELIVERABLES: '成果物',
    };
    const nextKey = getNextQuestion(mp);
    if (nextKey) {
      const filledCount = META_PROMPT_KEYS.filter((k) => mp.elements[k].confirmed).length;
      chat.addAssistantMessage(
        `❓ 質問 ${filledCount + 1}/${META_PROMPT_KEYS.length} 【${KEY_LABELS[nextKey]}】\n\n「${KEY_LABELS[nextKey]}」について教えてください。\n\n（「わからない」と答えるとAIが推定します）`,
        { stepId: StepId.CONTEXT_COLLECTION },
      );
    }
  }

  const handleContextAnswer = useCallback((answer: string) => {
    chat.addUserMessage(answer, StepId.CONTEXT_COLLECTION);

    const currentKey = getNextQuestion(metaPrompt);
    if (!currentKey) return;

    const isUnknown = /^(わからない|不明|未定|分からない)$/i.test(answer);

    if (isUnknown) {
      const msgId = chat.startStreaming(StepId.CONTEXT_COLLECTION);
      streamingMsgIdRef.current = msgId;

      streamFromAPI('estimate-context', { key: currentKey, metaPrompt },
        (chunk) => chat.appendToStreaming(msgId, chunk),
        (fullText) => {
          chat.finishStreaming(msgId);
          const newMeta = {
            ...metaPrompt,
            elements: {
              ...metaPrompt.elements,
              [currentKey]: { key: currentKey, value: fullText.trim(), source: 'ai' as const, confirmed: true },
            },
          };
          setMetaPrompt(newMeta);
          checkContextComplete(newMeta);
        },
      );
      return;
    }

    const newMeta = {
      ...metaPrompt,
      elements: {
        ...metaPrompt.elements,
        [currentKey]: { key: currentKey, value: answer, source: 'user' as const, confirmed: true },
      },
    };
    setMetaPrompt(newMeta);
    checkContextComplete(newMeta);
  }, [metaPrompt, projectId]);

  function checkContextComplete(mp: MetaPrompt) {
    const allDone = META_PROMPT_KEYS.every((k) => mp.elements[k]?.confirmed);
    if (allDone) {
      chat.addAssistantMessage('すべての情報が揃いました。内容を確認してください：', {
        richContent: { type: 'meta-prompt-table', data: mp },
        stepId: StepId.CONTEXT_COLLECTION,
      });
      setStepPhase('context-reviewing');
    } else {
      askNextQuestion(mp);
    }
  }

  // --- Generation step handlers (ResearchPlan, Azure, Proposal) ---
  const handleGenerate = useCallback((action: string, label: string) => {
    const msgId = chat.startStreaming(currentStep);
    streamingMsgIdRef.current = msgId;
    setStepPhase('streaming');

    streamFromAPI(action, {},
      (chunk) => chat.appendToStreaming(msgId, chunk),
      (fullText) => {
        chat.finishStreaming(msgId);
        setGeneratedContent((prev) => ({ ...prev, [currentStep]: fullText }));
        setStepPhase('confirming');

        // Save deliverable
        const deliverableNames: Record<string, string> = {
          [StepId.RESEARCH_PLAN]: 'phase1-research-plan.md',
          [StepId.AZURE_ARCHITECTURE]: 'phase2-azure-architecture.md',
        };
        const delivName = deliverableNames[currentStep];
        if (delivName) {
          fetch(`/api/projects/${encodeURIComponent(projectId)}/deliverables`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: delivName, content: fullText }),
          }).catch(() => {});
        }

        chat.addAssistantMessage('', {
          richContent: {
            type: 'confirmation',
            title: `${label}の確認`,
            summary: `${label}が生成されました。\nこの内容で次のステップに進みますか？`,
          },
          stepId: currentStep,
        });
      },
    );
  }, [currentStep, projectId]);

  // --- Cost Estimate handler ---
  const handleCostEstimate = useCallback(async () => {
    chat.addAssistantMessage('💰 コスト見積もりを算出中...', { stepId: StepId.COST_ESTIMATE });
    setStepPhase('streaming');

    try {
      const res = await fetch('/api/llm/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'estimate-cost', params: {} }),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
        }

        for (const line of buffer.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const json = trimmed.slice(6);
            if (json === '[DONE]') break;
            try {
              const chunk = JSON.parse(json) as { content?: string; done?: boolean };
              if (chunk.content) {
                const data = JSON.parse(chunk.content) as CostEstimate;
                chat.addAssistantMessage('コスト見積もり結果：', {
                  richContent: { type: 'cost-table', data },
                  stepId: StepId.COST_ESTIMATE,
                });
                chat.addAssistantMessage('', {
                  richContent: {
                    type: 'confirmation',
                    title: 'コスト見積もりの確認',
                    summary: `合計: ¥${data.directCostTotal.toLocaleString()}（直接経費）\nこの見積もりで次のステップに進みますか？`,
                  },
                  stepId: StepId.COST_ESTIMATE,
                });
                setStepPhase('confirming');
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      chat.addAssistantMessage('⚠️ 見積もりに失敗しました。もう一度お試しください。', { stepId: StepId.COST_ESTIMATE });
    }
    setStepPhase('idle');
  }, [projectId]);

  // --- Proposal section handler ---
  const handleProposalGenerate = useCallback((sectionId: ProposalSectionId) => {
    setCurrentProposalSection(sectionId);
    chat.addAssistantMessage(`📝 「${SECTION_LABELS[sectionId]}」セクションを生成中...`, { stepId: StepId.PROPOSAL });

    const msgId = chat.startStreaming(StepId.PROPOSAL);
    streamingMsgIdRef.current = msgId;

    streamFromAPI('generate-proposal', { sectionId },
      (chunk) => chat.appendToStreaming(msgId, chunk),
      (fullText) => {
        chat.finishStreaming(msgId);
        setProposalSections((prev) => ({ ...prev, [sectionId]: fullText }));

        // Save
        const updated = { ...proposalSections, [sectionId]: fullText };
        fetch(`/api/projects/${encodeURIComponent(projectId)}/deliverables`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'phase3-proposal.md', content: JSON.stringify(updated) }),
        }).catch(() => {});

        // Check if all sections done
        const allDone = SECTION_ORDER.every((id) => updated[id]?.trim());
        if (allDone) {
          chat.addAssistantMessage('', {
            richContent: {
              type: 'confirmation',
              title: '申請書の確認',
              summary: '申請書の全セクションが作成されました。\n次のステップ（レビュー）に進みますか？',
            },
            stepId: StepId.PROPOSAL,
          });
          setStepPhase('confirming');
        }
      },
    );
  }, [projectId, proposalSections]);

  // --- Review handler ---
  const handleReview = useCallback(() => {
    const msgId = chat.startStreaming(StepId.PROPOSAL_REVIEW);
    streamingMsgIdRef.current = msgId;

    streamFromAPI('review-proposal', {},
      (chunk) => chat.appendToStreaming(msgId, chunk),
      (fullText) => {
        chat.finishStreaming(msgId);
        try {
          const data = JSON.parse(fullText) as ReviewScoresData;
          chat.addAssistantMessage('レビュー結果：', {
            richContent: { type: 'review-scores', data },
            stepId: StepId.PROPOSAL_REVIEW,
          });
          chat.addAssistantMessage('', {
            richContent: {
              type: 'confirmation',
              title: 'レビュー結果の確認',
              summary: `合計スコア: ${data.totalScore}/18\n次のステップ（最終チェック）に進みますか？`,
            },
            stepId: StepId.PROPOSAL_REVIEW,
          });
          setStepPhase('confirming');
        } catch {
          // Non-JSON review — show as markdown
          chat.addAssistantMessage('', {
            richContent: {
              type: 'confirmation',
              title: 'レビュー完了',
              summary: '次のステップに進みますか？',
            },
            stepId: StepId.PROPOSAL_REVIEW,
          });
          setStepPhase('confirming');
        }
      },
    );
  }, [projectId]);

  // --- Final review handler ---
  const handleFinalReview = useCallback(async () => {
    chat.addAssistantMessage('✅ 最終チェックを実行中...', { stepId: StepId.FINAL_REVIEW });

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/final-review`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = (await res.json()) as FinalCheckData;
        chat.addAssistantMessage('最終チェック結果：', {
          richContent: { type: 'final-check', data },
          stepId: StepId.FINAL_REVIEW,
        });
        chat.addAssistantMessage('成果物をダウンロードできます：', {
          richContent: { type: 'download-links', projectId },
          stepId: StepId.FINAL_REVIEW,
        });
      }
    } catch {
      chat.addAssistantMessage('⚠️ 最終チェックに失敗しました。', { stepId: StepId.FINAL_REVIEW });
    }
  }, [projectId]);

  // --- Action dispatcher ---
  const handleAction = useCallback((action: string) => {
    switch (action) {
      case 'approve-meta':
        setMetaPrompt((prev) => ({ ...prev, approved: true }));
        chat.addSystemMessage('✅ メタプロンプト承認済み');
        advanceToNextStep();
        break;

      case 'edit-meta':
        chat.addAssistantMessage(
          '修正したい項目について、「項目名: 新しい内容」の形式で入力してください。\n例: 研究目的: 新しい研究目的の説明',
          { stepId: StepId.CONTEXT_COLLECTION },
        );
        setStepPhase('context-questioning');
        break;

      case 'confirm':
        advanceToNextStep();
        break;

      case 'revise':
        chat.addAssistantMessage('再生成するには「生成」ボタンを押してください。', { stepId: currentStep });
        setStepPhase('idle');
        break;

      case 'generate-research-plan':
        handleGenerate('generate-research-plan', '研究プラン');
        break;

      case 'generate-azure':
        handleGenerate('design-azure', 'Azure構成設計');
        break;

      case 'estimate-cost':
        handleCostEstimate();
        break;

      case 'start-review':
        handleReview();
        break;

      case 'final-check':
        handleFinalReview();
        break;

      default:
        // Proposal section generation
        if (action.startsWith('generate-section-')) {
          const sectionId = action.replace('generate-section-', '') as ProposalSectionId;
          handleProposalGenerate(sectionId);
        }
        break;
    }
  }, [currentStep, handleGenerate, handleCostEstimate, handleReview, handleFinalReview, handleProposalGenerate]);

  // --- User input handler ---
  const handleSend = useCallback((text: string) => {
    switch (stepPhase) {
      case 'context-initial':
        handleContextInitialSubmit(text);
        break;
      case 'context-questioning':
        handleContextAnswer(text);
        break;
      default:
        chat.addUserMessage(text, currentStep);
        break;
    }
  }, [stepPhase, handleContextInitialSubmit, handleContextAnswer, currentStep]);

  // --- Action buttons for current step ---
  function getActionButtons(): ActionButton[] {
    const disabled = isStreaming;

    switch (currentStep) {
      case StepId.CONTEXT_COLLECTION:
        return [];
      case StepId.RESEARCH_PLAN:
        return [{ label: '📝 研究プラン生成', action: 'generate-research-plan', variant: 'primary', disabled }];
      case StepId.AZURE_ARCHITECTURE:
        return [{ label: '☁️ Azure構成生成', action: 'generate-azure', variant: 'primary', disabled }];
      case StepId.COST_ESTIMATE:
        return [{ label: '💰 コスト見積もり', action: 'estimate-cost', variant: 'primary', disabled }];
      case StepId.PROPOSAL:
        return SECTION_ORDER.map((id) => ({
          label: `📝 ${SECTION_LABELS[id]}`,
          action: `generate-section-${id}`,
          variant: proposalSections[id] ? 'secondary' as const : 'primary' as const,
          disabled,
        }));
      case StepId.PROPOSAL_REVIEW:
        return [{ label: '🔍 レビュー開始', action: 'start-review', variant: 'primary', disabled }];
      case StepId.FINAL_REVIEW:
        return [{ label: '✅ 最終チェック', action: 'final-check', variant: 'primary', disabled }];
      default:
        return [];
    }
  }

  // --- Placeholder text for current step ---
  function getPlaceholder(): string {
    switch (stepPhase) {
      case 'context-initial':
        return '研究の概要を入力してください...（例: 無機固体材料の探索をAIで加速したい）';
      case 'context-questioning': {
        const KEY_LABELS: Record<MetaPromptKey, string> = {
          PURPOSE: '研究目的', TARGET: '対象領域', SCOPE: '研究範囲',
          TIMELINE: 'スケジュール', CONSTRAINTS: '制約条件', DELIVERABLES: '成果物',
        };
        const nextKey = getNextQuestion(metaPrompt);
        return nextKey ? `${KEY_LABELS[nextKey]}を入力...（「わからない」でAI推定）` : 'メッセージを入力...';
      }
      default:
        return 'メッセージを入力...';
    }
  }

  return (
    <div className="flex flex-col h-full" data-testid="chat-step-controller">
      <ChatThread messages={chat.messages} onAction={handleAction} />
      <ChatInput
        onSend={handleSend}
        placeholder={getPlaceholder()}
        disabled={isStreaming || stepPhase === 'context-analyzing'}
        actionButtons={getActionButtons()}
        onAction={handleAction}
      />
    </div>
  );
}
