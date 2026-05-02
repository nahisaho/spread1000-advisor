import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { MetaPrompt, MetaPromptKey } from '@/domain/models/MetaPrompt';
import { getNextQuestion, isSufficient } from '@/domain/models/MetaPrompt';
import type { ContextCollectorPrompt } from '@/application/prompts/context-collector';

export class CollectContextUseCase {
  constructor(
    private readonly llmProvider: ILLMProvider,
    private readonly projectRepo: IProjectRepository,
    private readonly prompt: ContextCollectorPrompt,
  ) {}

  async *askNextQuestion(
    projectId: string,
    metaPrompt: MetaPrompt,
  ): AsyncGenerator<LLMStreamChunk> {
    const nextKey = getNextQuestion(metaPrompt);
    if (!nextKey) return;

    const messages = this.prompt.build(nextKey, metaPrompt);
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
