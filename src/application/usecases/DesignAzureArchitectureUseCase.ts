import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { MetaPrompt } from '@/domain/models/MetaPrompt';
import type { AzureArchitectPrompt } from '@/application/prompts/azure-architect';
import { appendDisclaimer } from '@/lib/disclaimer';

export class DesignAzureArchitectureUseCase {
  constructor(
    private readonly llmProvider: ILLMProvider,
    private readonly projectRepo: IProjectRepository,
    private readonly prompt: AzureArchitectPrompt,
  ) {}

  async *execute(
    projectId: string,
    metaPrompt: MetaPrompt,
  ): AsyncGenerator<LLMStreamChunk> {
    const researchPlan = await this.projectRepo.loadDeliverable(projectId, 'phase0-research-plan.md');
    if (researchPlan === null) {
      throw new Error(`Research plan not found for project "${projectId}". Run Phase 0 first.`);
    }

    const messages = this.prompt.build(metaPrompt, researchPlan);
    let fullText = '';

    for await (const chunk of this.llmProvider.chatCompletionStream(messages)) {
      fullText += chunk.content;
      yield chunk;
    }

    const withDisclaimer = appendDisclaimer(fullText);
    await this.projectRepo.saveDeliverable(projectId, 'phase1-azure-architecture.md', withDisclaimer);
  }
}
