import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockModelsList = vi.fn();

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: mockCreate } };
      models = { list: mockModelsList };
    },
  };
});

import { OpenAIProvider } from './OpenAIProvider';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider({ apiKey: 'test-key', model: 'gpt-4' });
  });

  it('has correct providerId and displayName', () => {
    expect(provider.providerId).toBe('openai');
    expect(provider.displayName).toBe('OpenAI');
  });

  describe('chatCompletion', () => {
    it('returns response content', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hello!' } }],
      });

      const result = await provider.chatCompletion([
        { role: 'user', content: 'Hi' },
      ]);

      expect(result).toBe('Hello!');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          stream: false,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        expect.anything()
      );
    });

    it('returns empty string when no content', async () => {
      mockCreate.mockResolvedValue({ choices: [{ message: {} }] });
      const result = await provider.chatCompletion([
        { role: 'user', content: 'Hi' },
      ]);
      expect(result).toBe('');
    });

    it('passes options correctly', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      });

      await provider.chatCompletion(
        [{ role: 'user', content: 'Hi' }],
        { temperature: 0.5, maxTokens: 100, model: 'gpt-3.5-turbo' }
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          temperature: 0.5,
          max_tokens: 100,
        }),
        expect.anything()
      );
    });
  });

  describe('chatCompletionStream', () => {
    it('yields chunks from stream', async () => {
      const chunks = [
        { choices: [{ delta: { content: 'Hel' }, finish_reason: null }] },
        { choices: [{ delta: { content: 'lo' }, finish_reason: null }] },
        { choices: [{ delta: { content: '' }, finish_reason: 'stop' }] },
      ];

      mockCreate.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) yield chunk;
        },
      });

      const results = [];
      for await (const chunk of provider.chatCompletionStream([
        { role: 'user', content: 'Hi' },
      ])) {
        results.push(chunk);
      }

      expect(results).toEqual([
        { content: 'Hel', done: false },
        { content: 'lo', done: false },
        { content: '', done: true },
      ]);
    });
  });

  describe('testConnection', () => {
    it('returns ok on success', async () => {
      mockModelsList.mockResolvedValue({ data: [] });
      const result = await provider.testConnection();
      expect(result).toEqual({ ok: true });
    });

    it('returns error on failure', async () => {
      mockModelsList.mockRejectedValue(new Error('Unauthorized'));
      const result = await provider.testConnection();
      expect(result).toEqual({ ok: false, error: 'Unauthorized' });
    });
  });

  describe('listModels', () => {
    it('returns model ids', async () => {
      mockModelsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { id: 'gpt-4' };
          yield { id: 'gpt-3.5-turbo' };
        },
      });

      const models = await provider.listModels();
      expect(models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
    });
  });
});
