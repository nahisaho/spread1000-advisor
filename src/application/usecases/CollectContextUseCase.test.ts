import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollectContextUseCase } from './CollectContextUseCase';
import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { ContextCollectorPrompt } from '@/application/prompts/context-collector';
import { createEmptyMetaPrompt } from '@/domain/models/MetaPrompt';
import type { MetaPrompt } from '@/domain/models/MetaPrompt';

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

function createMockPrompt(): ContextCollectorPrompt {
  return {
    build: vi.fn().mockReturnValue([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ]),
    buildQuestion: vi.fn().mockReturnValue([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ]),
    buildAnalysis: vi.fn().mockReturnValue([
      { role: 'system', content: 'analysis prompt' },
      { role: 'user', content: 'user input' },
    ]),
    buildEstimate: vi.fn().mockReturnValue([
      { role: 'system', content: 'estimate prompt' },
      { role: 'user', content: 'estimate request' },
    ]),
  } as unknown as ContextCollectorPrompt;
}

function createSufficientMetaPrompt(): MetaPrompt {
  return {
    elements: {
      PURPOSE: { key: 'PURPOSE', value: 'test purpose', source: 'user', confirmed: true },
      TARGET: { key: 'TARGET', value: 'test target', source: 'user', confirmed: true },
      SCOPE: { key: 'SCOPE', value: 'test scope', source: 'user', confirmed: true },
      TIMELINE: { key: 'TIMELINE', value: 'test timeline', source: 'user', confirmed: true },
      CONSTRAINTS: { key: 'CONSTRAINTS', value: 'test constraints', source: 'user', confirmed: true },
      DELIVERABLES: { key: 'DELIVERABLES', value: 'test deliverables', source: 'user', confirmed: true },
    },
    approved: false,
  };
}

describe('CollectContextUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('askNextQuestion', () => {
    it('yields chunks from LLM when there is a next question', async () => {
      const chunks: LLMStreamChunk[] = [
        { content: 'What is ', done: false },
        { content: 'your purpose?', done: true },
      ];
      const llm = createMockLLM(chunks);
      const repo = createMockRepo();
      const prompt = createMockPrompt();
      const useCase = new CollectContextUseCase(llm, repo, prompt);

      const metaPrompt = createEmptyMetaPrompt();
      const result: LLMStreamChunk[] = [];
      for await (const chunk of useCase.askNextQuestion('proj-1', metaPrompt)) {
        result.push(chunk);
      }

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('What is ');
      expect(result[1].content).toBe('your purpose?');
      expect(prompt.buildQuestion).toHaveBeenCalledWith('PURPOSE', metaPrompt, 1, 6);
    });

    it('yields nothing when all questions are answered', async () => {
      const llm = createMockLLM([]);
      const repo = createMockRepo();
      const prompt = createMockPrompt();
      const useCase = new CollectContextUseCase(llm, repo, prompt);

      const metaPrompt = createSufficientMetaPrompt();
      const result: LLMStreamChunk[] = [];
      for await (const chunk of useCase.askNextQuestion('proj-1', metaPrompt)) {
        result.push(chunk);
      }

      expect(result).toHaveLength(0);
      expect(llm.chatCompletionStream).not.toHaveBeenCalled();
    });
  });

  describe('saveAnswer', () => {
    it('persists and returns updated metaPrompt', async () => {
      const saveFn = vi.fn();
      const repo = createMockRepo({ saveDeliverable: saveFn });
      const llm = createMockLLM([]);
      const prompt = createMockPrompt();
      const useCase = new CollectContextUseCase(llm, repo, prompt);

      const metaPrompt = createEmptyMetaPrompt();
      const updated = await useCase.saveAnswer('proj-1', metaPrompt, 'PURPOSE', 'AI drug discovery');

      expect(updated.elements.PURPOSE.value).toBe('AI drug discovery');
      expect(updated.elements.PURPOSE.confirmed).toBe(true);
      expect(updated.elements.PURPOSE.source).toBe('user');
      expect(saveFn).toHaveBeenCalledWith('proj-1', 'meta-prompt.md', expect.stringContaining('AI drug discovery'));
    });

    it('preserves existing answers when saving a new one', async () => {
      const repo = createMockRepo();
      const llm = createMockLLM([]);
      const prompt = createMockPrompt();
      const useCase = new CollectContextUseCase(llm, repo, prompt);

      let metaPrompt = createEmptyMetaPrompt();
      metaPrompt = await useCase.saveAnswer('proj-1', metaPrompt, 'PURPOSE', 'Purpose value');
      metaPrompt = await useCase.saveAnswer('proj-1', metaPrompt, 'TARGET', 'Target value');

      expect(metaPrompt.elements.PURPOSE.value).toBe('Purpose value');
      expect(metaPrompt.elements.TARGET.value).toBe('Target value');
    });
  });

  describe('isComplete', () => {
    it('returns true when all elements are sufficient', () => {
      const llm = createMockLLM([]);
      const repo = createMockRepo();
      const prompt = createMockPrompt();
      const useCase = new CollectContextUseCase(llm, repo, prompt);

      expect(useCase.isComplete(createSufficientMetaPrompt())).toBe(true);
    });

    it('returns false when elements are incomplete', () => {
      const llm = createMockLLM([]);
      const repo = createMockRepo();
      const prompt = createMockPrompt();
      const useCase = new CollectContextUseCase(llm, repo, prompt);

      expect(useCase.isComplete(createEmptyMetaPrompt())).toBe(false);
    });
  });
});
