import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { MetaPrompt } from '@/domain/models/MetaPrompt';
import type { ResearchPlannerPrompt } from '@/application/prompts/research-planner';
import { appendDisclaimer } from '@/lib/disclaimer';

export class GenerateResearchPlanUseCase {
  constructor(
    private readonly llmProvider: ILLMProvider,
    private readonly projectRepo: IProjectRepository,
    private readonly prompt: ResearchPlannerPrompt,
  ) {}

  async *execute(
    projectId: string,
    metaPrompt: MetaPrompt,
  ): AsyncGenerator<LLMStreamChunk> {
    const messages = this.prompt.build(metaPrompt);
    let fullText = '';

    for await (const chunk of this.llmProvider.chatCompletionStream(messages)) {
      fullText += chunk.content;
      yield chunk;
    }

    const withDisclaimer = appendDisclaimer(fullText);
    await this.projectRepo.saveDeliverable(projectId, 'phase0-research-plan.md', withDisclaimer);
  }
}
