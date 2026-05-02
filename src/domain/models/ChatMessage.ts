import type { StepId } from './WizardStep';
import type { CostEstimate } from './CostEstimate';
import type { MetaPrompt } from './MetaPrompt';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ActionButton {
  readonly label: string;
  readonly action: string;
  readonly variant?: 'primary' | 'secondary' | 'danger';
  readonly disabled?: boolean;
}

export type RichContent =
  | { readonly type: 'markdown'; readonly content: string; readonly editable?: boolean }
  | { readonly type: 'cost-table'; readonly data: CostEstimate }
  | { readonly type: 'review-scores'; readonly data: ReviewScoresData }
  | { readonly type: 'meta-prompt-table'; readonly data: MetaPrompt }
  | { readonly type: 'final-check'; readonly data: FinalCheckData }
  | { readonly type: 'step-divider'; readonly stepId: StepId; readonly label: string }
  | { readonly type: 'action-buttons'; readonly buttons: readonly ActionButton[] }
  | { readonly type: 'confirmation'; readonly title: string; readonly summary: string }
  | { readonly type: 'download-links'; readonly projectId: string };

export interface ReviewScoresData {
  readonly criteria: readonly {
    readonly criterionId: string;
    readonly criterionName: string;
    readonly grade: string;
    readonly points: number;
    readonly suggestion: string;
  }[];
  readonly totalScore: number;
  readonly actionItems: readonly {
    readonly priority: string;
    readonly description: string;
    readonly relatedSection: string;
  }[];
}

export interface FinalCheckData {
  readonly mandatoryChecks: readonly { readonly id: string; readonly label: string; readonly passed: boolean }[];
  readonly crossPhaseChecks: readonly { readonly id: string; readonly label: string; readonly passed: boolean; readonly detail?: string }[];
  readonly judgment: string;
}

export interface ChatMessage {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly richContent?: RichContent;
  readonly isStreaming?: boolean;
  readonly timestamp: Date;
  readonly stepId?: StepId;
}

let messageCounter = 0;

export function createMessage(
  role: MessageRole,
  content: string,
  options?: { richContent?: RichContent; stepId?: StepId; isStreaming?: boolean },
): ChatMessage {
  messageCounter += 1;
  return {
    id: `msg-${Date.now()}-${messageCounter}`,
    role,
    content,
    richContent: options?.richContent,
    stepId: options?.stepId,
    isStreaming: options?.isStreaming ?? false,
    timestamp: new Date(),
  };
}

export function createStepDivider(stepId: StepId, label: string): ChatMessage {
  return createMessage('system', '', {
    richContent: { type: 'step-divider', stepId, label },
    stepId,
  });
}
