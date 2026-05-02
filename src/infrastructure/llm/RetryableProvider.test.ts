import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import { RetryableProvider } from './RetryableProvider';

function createMockProvider(overrides?: Partial<ILLMProvider>): ILLMProvider {
  return {
    providerId: 'mock',
    displayName: 'Mock Provider',
    chatCompletion: vi.fn().mockResolvedValue('response'),
    chatCompletionStream: vi.fn().mockReturnValue(
      (async function* (): AsyncIterable<LLMStreamChunk> {
        yield { content: 'hi', done: true };
      })()
    ),
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
    listModels: vi.fn().mockResolvedValue(['model-1']),
    ...overrides,
  };
}

describe('RetryableProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delegates providerId and displayName', () => {
    const inner = createMockProvider();
    const retryable = new RetryableProvider(inner);
    expect(retryable.providerId).toBe('mock');
    expect(retryable.displayName).toBe('Mock Provider');
  });

  it('passes through successful chatCompletion', async () => {
    const inner = createMockProvider();
    const retryable = new RetryableProvider(inner);
    const result = await retryable.chatCompletion([{ role: 'user', content: 'Hi' }]);
    expect(result).toBe('response');
    expect(inner.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it('passes through chatCompletionStream without retry', async () => {
    const inner = createMockProvider();
    const retryable = new RetryableProvider(inner);

    const results = [];
    for await (const chunk of retryable.chatCompletionStream([
      { role: 'user', content: 'Hi' },
    ])) {
      results.push(chunk);
    }
    expect(results).toEqual([{ content: 'hi', done: true }]);
  });

  it('retries on timeout errors', async () => {
    const inner = createMockProvider({
      chatCompletion: vi
        .fn()
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValue('success'),
    });

    const retryable = new RetryableProvider(inner, { baseDelayMs: 100 });

    const promise = retryable.chatCompletion([{ role: 'user', content: 'Hi' }]);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toBe('success');
    expect(inner.chatCompletion).toHaveBeenCalledTimes(2);
  });

  it('retries on rate limit errors', async () => {
    const rateLimitError = Object.assign(new Error('Too many requests'), { status: 429 });
    const inner = createMockProvider({
      chatCompletion: vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('ok'),
    });

    const retryable = new RetryableProvider(inner, { baseDelayMs: 100 });

    const promise = retryable.chatCompletion([{ role: 'user', content: 'Hi' }]);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toBe('ok');
    expect(inner.chatCompletion).toHaveBeenCalledTimes(2);
  });

  it('does not retry on auth errors', async () => {
    const authError = Object.assign(new Error('Unauthorized'), { status: 401 });
    const inner = createMockProvider({
      chatCompletion: vi.fn().mockRejectedValue(authError),
    });

    const retryable = new RetryableProvider(inner, { baseDelayMs: 100 });

    await expect(
      retryable.chatCompletion([{ role: 'user', content: 'Hi' }])
    ).rejects.toThrow('Unauthorized');
    expect(inner.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it('stops after max retries', async () => {
    vi.useRealTimers();

    const inner = createMockProvider({
      chatCompletion: vi.fn().mockRejectedValue(new Error('Request timeout')),
    });

    const retryable = new RetryableProvider(inner, {
      maxRetries: 3,
      baseDelayMs: 1,
    });

    await expect(
      retryable.chatCompletion([{ role: 'user', content: 'Hi' }])
    ).rejects.toThrow('Request timeout');
    // 1 initial + 3 retries = 4 total
    expect(inner.chatCompletion).toHaveBeenCalledTimes(4);
  });

  it('uses exponential backoff', async () => {
    const sleepCalls: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;

    const inner = createMockProvider({
      chatCompletion: vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('done'),
    });

    const retryable = new RetryableProvider(inner, { baseDelayMs: 1000 });

    const promise = retryable.chatCompletion([{ role: 'user', content: 'Hi' }]);

    // First retry: 1000ms (1000 * 2^0)
    await vi.advanceTimersByTimeAsync(1000);
    // Second retry: 2000ms (1000 * 2^1)
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toBe('done');
    expect(inner.chatCompletion).toHaveBeenCalledTimes(3);
  });

  it('delegates testConnection without retry', async () => {
    const inner = createMockProvider();
    const retryable = new RetryableProvider(inner);
    const result = await retryable.testConnection();
    expect(result).toEqual({ ok: true });
    expect(inner.testConnection).toHaveBeenCalledTimes(1);
  });

  it('retries listModels on retryable errors', async () => {
    const inner = createMockProvider({
      listModels: vi
        .fn()
        .mockRejectedValueOnce(new Error('socket hang up'))
        .mockResolvedValue(['m1']),
    });

    const retryable = new RetryableProvider(inner, { baseDelayMs: 100 });

    const promise = retryable.listModels();
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toEqual(['m1']);
  });
});
