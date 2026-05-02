import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateProposalUseCase } from './GenerateProposalUseCase';
import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { MetaPrompt } from '@/domain/models/MetaPrompt';
import type { Proposal } from '@/domain/models/Proposal';
import { createEmptyMetaPrompt } from '@/domain/models/MetaPrompt';
import { ProposalWriterPrompt } from '@/application/prompts/proposal-writer';
import { DISCLAIMER_TEXT } from '@/lib/disclaimer';

function createMockRepo(overrides: Partial<IProjectRepository> = {}): IProjectRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateWizardState: vi.fn(),
    saveDeliverable: vi.fn(),
    loadDeliverable: vi.fn().mockResolvedValue(null),
    listDeliverables: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

async function* fakeStream(texts: string[]): AsyncIterable<LLMStreamChunk> {
  for (let i = 0; i < texts.length; i++) {
    yield { content: texts[i], done: i === texts.length - 1 };
  }
}

function createMockLLM(streamTexts: string[]): ILLMProvider {
  return {
    providerId: 'test',
    displayName: 'Test LLM',
    chatCompletion: vi.fn().mockResolvedValue(''),
    chatCompletionStream: vi.fn().mockReturnValue(fakeStream(streamTexts)),
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
  };
}

function createTestMetaPrompt(): MetaPrompt {
  const mp = createEmptyMetaPrompt();
  const elements = { ...mp.elements };
  elements.PURPOSE = { key: 'PURPOSE', value: 'AIで農業最適化', source: 'user', confirmed: true };
  return { ...mp, elements, approved: true };
}

describe('GenerateProposalUseCase', () => {
  const writerPrompt = new ProposalWriterPrompt();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('yields stream chunks from LLM', async () => {
    const repo = createMockRepo({
      loadDeliverable: vi.fn().mockResolvedValue('# Research Plan'),
    });
    const llm = createMockLLM(['AIを活用した', '農業最適化の', '研究']);
    const useCase = new GenerateProposalUseCase(llm, repo, writerPrompt);

    const chunks: LLMStreamChunk[] = [];
    for await (const chunk of useCase.generateSection('proj-1', 'research_purpose', createTestMetaPrompt())) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(3);
    expect(chunks[0].content).toBe('AIを活用した');
    expect(chunks[2].done).toBe(true);
  });

  it('loads research plan and azure architecture', async () => {
    const loadDeliverable = vi.fn()
      .mockResolvedValueOnce('# Research Plan')
      .mockResolvedValueOnce('# Azure Arch');
    const repo = createMockRepo({ loadDeliverable });
    const llm = createMockLLM(['content']);
    const useCase = new GenerateProposalUseCase(llm, repo, writerPrompt);

    // Consume the generator
    for await (const _ of useCase.generateSection('proj-1', 'research_purpose', createTestMetaPrompt())) {
      // consume
    }

    expect(loadDeliverable).toHaveBeenCalledWith('proj-1', 'phase0-research-plan.md');
    expect(loadDeliverable).toHaveBeenCalledWith('proj-1', 'phase1-azure-architecture.md');
  });

  it('works when deliverables are not found', async () => {
    const repo = createMockRepo();
    const llm = createMockLLM(['fallback content']);
    const useCase = new GenerateProposalUseCase(llm, repo, writerPrompt);

    const chunks: LLMStreamChunk[] = [];
    for await (const chunk of useCase.generateSection('proj-1', 'research_purpose', createTestMetaPrompt())) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
  });

  it('saveProposal persists markdown with disclaimer', async () => {
    const saveDeliverable = vi.fn();
    const repo = createMockRepo({ saveDeliverable });
    const llm = createMockLLM([]);
    const useCase = new GenerateProposalUseCase(llm, repo, writerPrompt);

    const proposal: Proposal = {
      projectId: 'proj-1',
      sections: [
        {
          id: 'research_purpose',
          title: '研究目的',
          content: 'AIで農業を最適化する研究',
          charLimit: { min: 80, max: 400 },
        },
      ],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    await useCase.saveProposal('proj-1', proposal);

    expect(saveDeliverable).toHaveBeenCalledWith(
      'proj-1',
      'phase3-proposal.md',
      expect.stringContaining(DISCLAIMER_TEXT),
    );
    const savedContent = saveDeliverable.mock.calls[0][2];
    expect(savedContent).toContain('AIで農業を最適化する研究');
    expect(savedContent).toContain('## 研究目的');
  });
});
