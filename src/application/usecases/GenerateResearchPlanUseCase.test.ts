import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateResearchPlanUseCase } from './GenerateResearchPlanUseCase';
import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { ResearchPlannerPrompt } from '@/application/prompts/research-planner';
import type { MetaPrompt } from '@/domain/models/MetaPrompt';
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

async function* fakeStream(chunks: LLMStreamChunk[]): AsyncIterable<LLMStreamChunk> {
  for (const c of chunks) yield c;
}

function createMockLLM(chunks: LLMStreamChunk[]): ILLMProvider {
  return {
    providerId: 'mock',
    displayName: 'Mock LLM',
    chatCompletion: vi.fn().mockResolvedValue(''),
    chatCompletionStream: vi.fn().mockReturnValue(fakeStream(chunks)),
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
  };
}

function createMockPrompt(): ResearchPlannerPrompt {
  return {
    build: vi.fn().mockReturnValue([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ]),
  } as unknown as ResearchPlannerPrompt;
}

function createFilledMetaPrompt(): MetaPrompt {
  return {
    elements: {
      PURPOSE: { key: 'PURPOSE', value: 'AI research', source: 'user', confirmed: true },
      TARGET: { key: 'TARGET', value: 'proteins', source: 'user', confirmed: true },
      SCOPE: { key: 'SCOPE', value: 'drug discovery', source: 'user', confirmed: true },
      TIMELINE: { key: 'TIMELINE', value: '180 days', source: 'user', confirmed: true },
      CONSTRAINTS: { key: 'CONSTRAINTS', value: 'budget 5M', source: 'user', confirmed: true },
      DELIVERABLES: { key: 'DELIVERABLES', value: 'paper', source: 'user', confirmed: true },
    },
    approved: true,
  };
}

describe('GenerateResearchPlanUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('yields chunks from LLM stream', async () => {
    const chunks: LLMStreamChunk[] = [
      { content: '# Research ', done: false },
      { content: 'Plan', done: true },
    ];
    const llm = createMockLLM(chunks);
    const repo = createMockRepo();
    const prompt = createMockPrompt();
    const useCase = new GenerateResearchPlanUseCase(llm, repo, prompt);

    const result: LLMStreamChunk[] = [];
    for await (const chunk of useCase.execute('proj-1', createFilledMetaPrompt())) {
      result.push(chunk);
    }

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('# Research ');
    expect(result[1].content).toBe('Plan');
  });

  it('saves deliverable with disclaimer appended', async () => {
    const chunks: LLMStreamChunk[] = [
      { content: '# Plan content', done: true },
    ];
    const saveFn = vi.fn();
    const llm = createMockLLM(chunks);
    const repo = createMockRepo({ saveDeliverable: saveFn });
    const prompt = createMockPrompt();
    const useCase = new GenerateResearchPlanUseCase(llm, repo, prompt);

    // Consume the generator fully
    for await (const _ of useCase.execute('proj-1', createFilledMetaPrompt())) {
      // consume
    }

    expect(saveFn).toHaveBeenCalledOnce();
    const [projectId, filename, content] = saveFn.mock.calls[0];
    expect(projectId).toBe('proj-1');
    expect(content).toContain('# Plan content');
    expect(content).toContain(DISCLAIMER_TEXT);
  });

  it('saves to correct deliverable name', async () => {
    const chunks: LLMStreamChunk[] = [{ content: 'content', done: true }];
    const saveFn = vi.fn();
    const llm = createMockLLM(chunks);
    const repo = createMockRepo({ saveDeliverable: saveFn });
    const prompt = createMockPrompt();
    const useCase = new GenerateResearchPlanUseCase(llm, repo, prompt);

    for await (const _ of useCase.execute('proj-1', createFilledMetaPrompt())) {
      // consume
    }

    expect(saveFn).toHaveBeenCalledWith('proj-1', 'phase0-research-plan.md', expect.any(String));
  });
});
