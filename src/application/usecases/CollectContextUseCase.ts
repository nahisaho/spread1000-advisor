import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { MetaPrompt, MetaPromptKey } from '@/domain/models/MetaPrompt';
import { META_PROMPT_KEYS, getNextQuestion, isSufficient } from '@/domain/models/MetaPrompt';
import type { ContextCollectorPrompt } from '@/application/prompts/context-collector';

export interface AnalysisResult {
  [key: string]: { value: string | null; confidence: 'high' | 'medium' | 'low' | 'unknown' };
}

export class CollectContextUseCase {
  constructor(
    private readonly llmProvider: ILLMProvider,
    private readonly projectRepo: IProjectRepository,
    private readonly prompt: ContextCollectorPrompt,
  ) {}

  /**
   * Analyze user's initial free-text input to extract known elements.
   * Returns a MetaPrompt with auto-filled elements.
   */
  async analyzeInitialInput(
    projectId: string,
    userInput: string,
  ): Promise<MetaPrompt> {
    const messages = this.prompt.buildAnalysis(userInput);
    let fullResponse = '';

    for await (const chunk of this.llmProvider.chatCompletionStream(messages)) {
      fullResponse += chunk.content;
    }

    const parsed = this.parseAnalysisResponse(fullResponse);
    const elements = {} as MetaPrompt['elements'];

    for (const key of META_PROMPT_KEYS) {
      const result = parsed[key];
      if (result?.value && result.confidence !== 'unknown') {
        elements[key] = {
          key,
          value: result.value,
          source: 'estimated' as const,
          confirmed: false,
        };
      } else {
        elements[key] = {
          key,
          value: null,
          source: 'user' as const,
          confirmed: false,
        };
      }
    }

    return { elements, approved: false };
  }

  private parseAnalysisResponse(response: string): AnalysisResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return {};
      return JSON.parse(jsonMatch[0]) as AnalysisResult;
    } catch {
      return {};
    }
  }

  /**
   * Get the count of missing (unfilled) elements.
   */
  getMissingCount(metaPrompt: MetaPrompt): number {
    return META_PROMPT_KEYS.filter(
      (k) => !metaPrompt.elements[k].value || !metaPrompt.elements[k].confirmed,
    ).length;
  }

  /**
   * Get list of missing keys that still need answers.
   */
  getMissingKeys(metaPrompt: MetaPrompt): MetaPromptKey[] {
    return META_PROMPT_KEYS.filter(
      (k) => !metaPrompt.elements[k].value || !metaPrompt.elements[k].confirmed,
    );
  }

  async *askNextQuestion(
    projectId: string,
    metaPrompt: MetaPrompt,
  ): AsyncGenerator<LLMStreamChunk> {
    const nextKey = getNextQuestion(metaPrompt);
    if (!nextKey) return;

    const missingKeys = this.getMissingKeys(metaPrompt);
    const questionIndex = missingKeys.indexOf(nextKey) + 1;
    const totalQuestions = missingKeys.length;

    const messages = this.prompt.buildQuestion(nextKey, metaPrompt, questionIndex, totalQuestions);
    yield* this.llmProvider.chatCompletionStream(messages);
  }

  /**
   * Stream an estimated value proposal when user says "わからない".
   */
  async *proposeEstimate(
    projectId: string,
    key: MetaPromptKey,
    metaPrompt: MetaPrompt,
  ): AsyncGenerator<LLMStreamChunk> {
    const messages = this.prompt.buildEstimate(key, metaPrompt);
    yield* this.llmProvider.chatCompletionStream(messages);
  }

  async saveAnswer(
    projectId: string,
    metaPrompt: MetaPrompt,
    key: MetaPromptKey,
    answer: string,
  ): Promise<MetaPrompt> {
    const updated: MetaPrompt = {
      ...metaPrompt,
      elements: {
        ...metaPrompt.elements,
        [key]: { key, value: answer, source: 'user' as const, confirmed: true },
      },
    };

    const markdown = this.serializeMetaPrompt(updated);
    await this.projectRepo.saveDeliverable(projectId, 'meta-prompt.md', markdown);

    return updated;
  }

  isComplete(metaPrompt: MetaPrompt): boolean {
    return isSufficient(metaPrompt);
  }

  private serializeMetaPrompt(metaPrompt: MetaPrompt): string {
    const lines = ['# メタプロンプト', ''];
    for (const elem of Object.values(metaPrompt.elements)) {
      const status = elem.confirmed ? '✅' : '⬜';
      lines.push(`## ${status} ${elem.key}`);
      lines.push('');
      lines.push(elem.value ?? '（未回答）');
      lines.push('');
    }
    return lines.join('\n');
  }
}
