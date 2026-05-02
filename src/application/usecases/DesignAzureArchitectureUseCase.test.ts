import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DesignAzureArchitectureUseCase } from './DesignAzureArchitectureUseCase';
import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { AzureArchitectPrompt } from '@/application/prompts/azure-architect';
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

function createMockPrompt(): AzureArchitectPrompt {
  return {
    build: vi.fn().mockReturnValue([
      { role: 'system', content: 'architect system' },
      { role: 'user', content: 'architect user' },
    ]),
  } as unknown as AzureArchitectPrompt;
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

describe('DesignAzureArchitectureUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads research plan before generating architecture', async () => {
    const chunks: LLMStreamChunk[] = [{ content: '# Arch', done: true }];
    const loadFn = vi.fn().mockResolvedValue('# Research Plan Content');
    const llm = createMockLLM(chunks);
    const repo = createMockRepo({ loadDeliverable: loadFn, saveDeliverable: vi.fn() });
    const prompt = createMockPrompt();
    const useCase = new DesignAzureArchitectureUseCase(llm, repo, prompt);

    for await (const _ of useCase.execute('proj-1', createFilledMetaPrompt())) {
      // consume
    }

    expect(loadFn).toHaveBeenCalledWith('proj-1', 'phase0-research-plan.md');
    expect(prompt.build).toHaveBeenCalledWith(
      createFilledMetaPrompt(),
      '# Research Plan Content',
    );
  });

  it('throws when research plan is not found', async () => {
    const llm = createMockLLM([]);
    const repo = createMockRepo();
    const prompt = createMockPrompt();
    const useCase = new DesignAzureArchitectureUseCase(llm, repo, prompt);

    const gen = useCase.execute('proj-1', createFilledMetaPrompt());
    await expect(gen.next()).rejects.toThrow('Research plan not found');
  });

  it('yields chunks from LLM stream', async () => {
    const chunks: LLMStreamChunk[] = [
      { content: '## Architecture ', done: false },
      { content: 'Design', done: true },
    ];
    const llm = createMockLLM(chunks);
    const repo = createMockRepo({
      loadDeliverable: vi.fn().mockResolvedValue('# Research plan'),
      saveDeliverable: vi.fn(),
    });
    const prompt = createMockPrompt();
    const useCase = new DesignAzureArchitectureUseCase(llm, repo, prompt);

    const result: LLMStreamChunk[] = [];
    for await (const chunk of useCase.execute('proj-1', createFilledMetaPrompt())) {
      result.push(chunk);
    }

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('## Architecture ');
    expect(result[1].content).toBe('Design');
  });

  it('saves with disclaimer to correct deliverable name', async () => {
    const chunks: LLMStreamChunk[] = [{ content: '# Azure Arch', done: true }];
    const saveFn = vi.fn();
    const llm = createMockLLM(chunks);
    const repo = createMockRepo({
      loadDeliverable: vi.fn().mockResolvedValue('# Plan'),
      saveDeliverable: saveFn,
    });
    const prompt = createMockPrompt();
    const useCase = new DesignAzureArchitectureUseCase(llm, repo, prompt);

    for await (const _ of useCase.execute('proj-1', createFilledMetaPrompt())) {
      // consume
    }

    expect(saveFn).toHaveBeenCalledOnce();
    const [projectId, filename, content] = saveFn.mock.calls[0];
    expect(projectId).toBe('proj-1');
    expect(filename).toBe('phase1-azure-architecture.md');
    expect(content).toContain('# Azure Arch');
    expect(content).toContain(DISCLAIMER_TEXT);
  });
});
