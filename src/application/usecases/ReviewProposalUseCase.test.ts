import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewProposalUseCase } from './ReviewProposalUseCase';
import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { Proposal } from '@/domain/models/Proposal';
import { createEmptyMetaPrompt } from '@/domain/models/MetaPrompt';
import { ProposalReviewerPrompt } from '@/application/prompts/proposal-reviewer';
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

const testProposal: Proposal = {
  projectId: 'proj-1',
  sections: [
    {
      id: 'research_purpose',
      title: '研究目的',
      content: 'AIで農業を最適化する研究',
      charLimit: { min: 80, max: 400 },
    },
    {
      id: 'ai_validity',
      title: 'AI活用の妥当性',
      content: '深層学習による画像認識を活用',
      charLimit: { min: 160, max: 800 },
    },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('ReviewProposalUseCase', () => {
  const reviewerPrompt = new ProposalReviewerPrompt();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('yields review chunks from LLM', async () => {
    const repo = createMockRepo({ saveDeliverable: vi.fn() });
    const llm = createMockLLM(['| 審査基準 |', ' 評価 |', ' コメント |']);
    const useCase = new ReviewProposalUseCase(llm, repo, reviewerPrompt);
    const metaPrompt = createEmptyMetaPrompt();

    const chunks: LLMStreamChunk[] = [];
    for await (const chunk of useCase.execute('proj-1', testProposal, metaPrompt)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(3);
    expect(chunks[0].content).toBe('| 審査基準 |');
  });

  it('saves review report with disclaimer', async () => {
    const saveDeliverable = vi.fn();
    const repo = createMockRepo({ saveDeliverable });
    const llm = createMockLLM(['レビュー結果: 良好']);
    const useCase = new ReviewProposalUseCase(llm, repo, reviewerPrompt);
    const metaPrompt = createEmptyMetaPrompt();

    for await (const _ of useCase.execute('proj-1', testProposal, metaPrompt)) {
      // consume
    }

    expect(saveDeliverable).toHaveBeenCalledWith(
      'proj-1',
      'review-report.md',
      expect.stringContaining(DISCLAIMER_TEXT),
    );
    const savedContent = saveDeliverable.mock.calls[0][2];
    expect(savedContent).toContain('レビュー結果: 良好');
  });

  it('builds prompt with proposal sections as record', async () => {
    const repo = createMockRepo({ saveDeliverable: vi.fn() });
    const llm = createMockLLM(['ok']);
    const useCase = new ReviewProposalUseCase(llm, repo, reviewerPrompt);
    const metaPrompt = createEmptyMetaPrompt();

    for await (const _ of useCase.execute('proj-1', testProposal, metaPrompt)) {
      // consume
    }

    expect(llm.chatCompletionStream).toHaveBeenCalledOnce();
    const messages = (llm.chatCompletionStream as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('research_purpose');
  });
});
