import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {},
    AzureOpenAI: class MockAzureOpenAI {
      chat = { completions: { create: mockCreate } };
    },
  };
});

import { AzureOpenAIProvider } from './AzureOpenAIProvider';

describe('AzureOpenAIProvider', () => {
  let provider: AzureOpenAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AzureOpenAIProvider({
      apiKey: 'test-key',
      endpoint: 'https://my-resource.openai.azure.com',
      deploymentName: 'my-deployment',
    });
  });

  it('has correct providerId and displayName', () => {
    expect(provider.providerId).toBe('azure-openai');
    expect(provider.displayName).toBe('Azure OpenAI');
  });

  describe('chatCompletion', () => {
    it('returns response content using deployment name', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Azure response' } }],
      });

      const result = await provider.chatCompletion([
        { role: 'user', content: 'Hi' },
      ]);

      expect(result).toBe('Azure response');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'my-deployment',
          stream: false,
        }),
        expect.anything()
      );
    });
  });

  describe('chatCompletionStream', () => {
    it('yields chunks from stream', async () => {
      const chunks = [
        { choices: [{ delta: { content: 'Hi' }, finish_reason: null }] },
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
        { content: 'Hi', done: false },
        { content: '', done: true },
      ]);
    });
  });

  describe('testConnection', () => {
    it('returns ok on success', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'pong' } }],
      });
      const result = await provider.testConnection();
      expect(result).toEqual({ ok: true });
    });

    it('returns error on failure', async () => {
      mockCreate.mockRejectedValue(new Error('Forbidden'));
      const result = await provider.testConnection();
      expect(result).toEqual({ ok: false, error: 'Forbidden' });
    });
  });

  it('does not have listModels', () => {
    expect((provider as any).listModels).toBeUndefined();
  });
});
