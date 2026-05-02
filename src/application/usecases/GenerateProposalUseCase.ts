import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { MetaPrompt } from '@/domain/models/MetaPrompt';
import type { Proposal, ProposalSectionId } from '@/domain/models/Proposal';
import { SECTION_CHAR_LIMITS } from '@/domain/models/Proposal';
import type { ProposalWriterPrompt } from '@/application/prompts/proposal-writer';
import { appendDisclaimer } from '@/lib/disclaimer';

function serializeProposal(proposal: Proposal): string {
  const lines: string[] = [
    '# SPReAD-1000 申請書（Phase 3）',
    '',
  ];

  for (const section of proposal.sections) {
    lines.push(`## ${section.title}`, '', section.content, '');
  }

  return lines.join('\n');
}

export class GenerateProposalUseCase {
  constructor(
    private readonly llmProvider: ILLMProvider,
    private readonly projectRepo: IProjectRepository,
    private readonly prompt: ProposalWriterPrompt,
  ) {}

  async *generateSection(
    projectId: string,
    sectionId: string,
    metaPrompt: MetaPrompt,
  ): AsyncGenerator<LLMStreamChunk> {
    const researchPlan =
      (await this.projectRepo.loadDeliverable(projectId, 'phase0-research-plan.md')) ?? '';
    const azureArch =
      (await this.projectRepo.loadDeliverable(projectId, 'phase1-azure-architecture.md')) ?? '';

    const charLimit = SECTION_CHAR_LIMITS[sectionId as ProposalSectionId] ?? { min: 0, max: 1000 };

    const messages = this.prompt.build(sectionId, metaPrompt, researchPlan, azureArch, charLimit);

    let fullText = '';
    for await (const chunk of this.llmProvider.chatCompletionStream(messages)) {
      fullText += chunk.content;
      yield chunk;
    }
  }

  async saveProposal(projectId: string, proposal: Proposal): Promise<void> {
    const markdown = serializeProposal(proposal);
    await this.projectRepo.saveDeliverable(
      projectId,
      'phase3-proposal.md',
      appendDisclaimer(markdown),
    );
  }
}
