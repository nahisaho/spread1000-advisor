// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

import { createLLMProvider } from '@/infrastructure/llm/LLMProviderFactory';
import { RetryableProvider } from '@/infrastructure/llm/RetryableProvider';
import type { ILLMProvider, ChatMessage, ChatCompletionOptions, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';

function createFakeProvider(overrides: Partial<ILLMProvider> = {}): ILLMProvider {
  return {
    providerId: 'fake',
    displayName: 'Fake Provider',
    async chatCompletion(): Promise<string> {
      return 'fake response';
    },
    async *chatCompletionStream(): AsyncIterable<LLMStreamChunk> {
      yield { content: 'fake', done: true };
    },
    async testConnection() {
      return { ok: true };
    },
    ...overrides,
  };
}

describe('LLM Provider Factory & Retry', () => {
  it('creates OpenAI provider', () => {
    const provider = createLLMProvider({
      type: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4',
    });
    expect(provider.providerId).toBe('openai');
    expect(provider.displayName).toContain('OpenAI');
  });

  it('creates Azure OpenAI provider', () => {
    const provider = createLLMProvider({
      type: 'azure-openai',
      apiKey: 'test-key',
      endpoint: 'https://test.openai.azure.com',
      model: 'gpt-4',
      deploymentName: 'gpt-4-deployment',
    });
    expect(provider.providerId).toBe('azure-openai');
  });

  it('creates Claude provider', () => {
    const provider = createLLMProvider({
      type: 'claude',
      apiKey: 'test-key',
      model: 'claude-3-sonnet',
    });
    expect(provider.providerId).toBe('claude');
  });

  it('creates Ollama provider', () => {
    const provider = createLLMProvider({
      type: 'ollama',
      model: 'llama3',
    });
    expect(provider.providerId).toBe('ollama');
  });

  it('throws on unknown provider type', () => {
    expect(() =>
      createLLMProvider({
        type: 'unknown' as 'openai',
        model: 'test',
      }),
    ).toThrow();
  });

  it('throws when required apiKey is missing for openai', () => {
    expect(() =>
      createLLMProvider({ type: 'openai', model: 'gpt-4' }),
    ).toThrow('apiKey is required');
  });

  it('throws when required fields are missing for azure-openai', () => {
    expect(() =>
      createLLMProvider({
        type: 'azure-openai',
        model: 'gpt-4',
        apiKey: 'key',
        endpoint: 'https://test.openai.azure.com',
        // missing deploymentName
      }),
    ).toThrow('deploymentName is required');
  });

  it('RetryableProvider retries on timeout', async () => {
    let callCount = 0;
    const inner = createFakeProvider({
      async chatCompletion(): Promise<string> {
        callCount++;
        if (callCount <= 2) {
          const err = new Error('timeout');
          throw err;
        }
        return 'success after retries';
      },
    });

    const retryable = new RetryableProvider(inner, { maxRetries: 3, baseDelayMs: 1 });
    const result = await retryable.chatCompletion([{ role: 'user', content: 'test' }]);

    expect(result).toBe('success after retries');
    expect(callCount).toBe(3);
  });

  it('RetryableProvider retries on rate limit (429)', async () => {
    let callCount = 0;
    const inner = createFakeProvider({
      async chatCompletion(): Promise<string> {
        callCount++;
        if (callCount <= 1) {
          const err = new Error('rate limited') as Error & { status: number };
          err.status = 429;
          throw err;
        }
        return 'success';
      },
    });

    const retryable = new RetryableProvider(inner, { maxRetries: 3, baseDelayMs: 1 });
    const result = await retryable.chatCompletion([{ role: 'user', content: 'test' }]);

    expect(result).toBe('success');
    expect(callCount).toBe(2);
  });

  it('RetryableProvider does not retry on auth error', async () => {
    let callCount = 0;
    const inner = createFakeProvider({
      async chatCompletion(): Promise<string> {
        callCount++;
        const err = new Error('Unauthorized: invalid API key') as Error & { status: number };
        err.status = 401;
        throw err;
      },
    });

    const retryable = new RetryableProvider(inner, { maxRetries: 3, baseDelayMs: 1 });

    await expect(
      retryable.chatCompletion([{ role: 'user', content: 'test' }]),
    ).rejects.toThrow('Unauthorized');

    expect(callCount).toBe(1);
  });

  it('RetryableProvider does not retry on 400 error', async () => {
    let callCount = 0;
    const inner = createFakeProvider({
      async chatCompletion(): Promise<string> {
        callCount++;
        const err = new Error('Bad Request') as Error & { status: number };
        err.status = 400;
        throw err;
      },
    });

    const retryable = new RetryableProvider(inner, { maxRetries: 3, baseDelayMs: 1 });

    await expect(
      retryable.chatCompletion([{ role: 'user', content: 'test' }]),
    ).rejects.toThrow('Bad Request');

    expect(callCount).toBe(1);
  });

  it('RetryableProvider exhausts retries and throws', async () => {
    let callCount = 0;
    const inner = createFakeProvider({
      async chatCompletion(): Promise<string> {
        callCount++;
        throw new Error('timeout');
      },
    });

    const retryable = new RetryableProvider(inner, { maxRetries: 2, baseDelayMs: 1 });

    await expect(
      retryable.chatCompletion([{ role: 'user', content: 'test' }]),
    ).rejects.toThrow('timeout');

    // initial call + 2 retries = 3
    expect(callCount).toBe(3);
  });

  it('RetryableProvider preserves provider identity', () => {
    const inner = createFakeProvider({
      providerId: 'my-provider',
      displayName: 'My Custom Provider',
    });

    const retryable = new RetryableProvider(inner);
    expect(retryable.providerId).toBe('my-provider');
    expect(retryable.displayName).toBe('My Custom Provider');
  });

  it('RetryableProvider delegates testConnection', async () => {
    const inner = createFakeProvider({
      async testConnection() {
        return { ok: false, error: 'connection refused' };
      },
    });

    const retryable = new RetryableProvider(inner);
    const result = await retryable.testConnection();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('connection refused');
  });
});
