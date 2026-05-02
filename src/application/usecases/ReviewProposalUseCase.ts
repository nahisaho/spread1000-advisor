import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { MetaPrompt } from '@/domain/models/MetaPrompt';
import type { Proposal } from '@/domain/models/Proposal';
import type { ProposalReviewerPrompt } from '@/application/prompts/proposal-reviewer';
import { appendDisclaimer } from '@/lib/disclaimer';

export class ReviewProposalUseCase {
  constructor(
    private readonly llmProvider: ILLMProvider,
    private readonly projectRepo: IProjectRepository,
    private readonly prompt: ProposalReviewerPrompt,
  ) {}

  async *execute(
    projectId: string,
    proposal: Proposal,
    metaPrompt: MetaPrompt,
  ): AsyncGenerator<LLMStreamChunk> {
    const proposalRecord = Object.fromEntries(
      proposal.sections.map((s) => [s.id, s.content]),
    );

    const messages = this.prompt.build(proposalRecord, metaPrompt);

    let fullText = '';
    for await (const chunk of this.llmProvider.chatCompletionStream(messages)) {
      fullText += chunk.content;
      yield chunk;
    }

    await this.projectRepo.saveDeliverable(
      projectId,
      'review-report.md',
      appendDisclaimer(fullText),
    );
  }
}
