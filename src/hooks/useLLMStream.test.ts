import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLLMStream } from './useLLMStream';

function createSSEStream(chunks: Array<{ content?: string; done?: boolean }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`);
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < lines.length) {
        controller.enqueue(encoder.encode(lines[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe('useLLMStream', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('returns correct initial state', () => {
    const { result } = renderHook(() => useLLMStream());
    expect(result.current.text).toBe('');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.start).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    expect(typeof result.current.retry).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('sets isStreaming to true when start is called', async () => {
    // Never-resolving fetch to keep streaming state
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>(() => {
          /* never resolves */
        }),
    );

    const { result } = renderHook(() => useLLMStream());

    act(() => {
      result.current.start('/api/test', { prompt: 'hello' });
    });

    expect(result.current.isStreaming).toBe(true);
  });

  it('accumulates text from SSE chunks', async () => {
    const stream = createSSEStream([
      { content: 'Hello' },
      { content: ' World' },
      { done: true },
    ]);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const { result } = renderHook(() => useLLMStream());

    await act(async () => {
      result.current.start('/api/test', { prompt: 'hello' });
      // Allow microtasks to process
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.text).toBe('Hello World');
    expect(result.current.isStreaming).toBe(false);
  });

  it('handles HTTP error responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );

    const onError = vi.fn();
    const { result } = renderHook(() => useLLMStream({ onError }));

    await act(async () => {
      result.current.start('/api/test', { prompt: 'hello' });
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.type).toBe('auth');
    expect(result.current.isStreaming).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('stop aborts the stream', async () => {
    let abortSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn(((_url: string, init?: RequestInit) => {
      abortSignal = init?.signal as AbortSignal;
      return new Promise<Response>(() => {
        /* never resolves */
      });
    }) as typeof fetch);

    const { result } = renderHook(() => useLLMStream());

    act(() => {
      result.current.start('/api/test', { prompt: 'hello' });
    });

    expect(result.current.isStreaming).toBe(true);

    act(() => {
      result.current.stop();
    });

    expect(result.current.isStreaming).toBe(false);
    expect(abortSignal?.aborted).toBe(true);
  });

  it('reset clears text and error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Server Error', { status: 500 }),
    );

    const { result } = renderHook(() => useLLMStream());

    await act(async () => {
      result.current.start('/api/test', { prompt: 'hello' });
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.text).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('retry re-executes the last start call', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(() => {
      callCount++;
      const stream = createSSEStream([{ content: `call${callCount}` }, { done: true }]);
      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      );
    });

    const { result } = renderHook(() => useLLMStream());

    await act(async () => {
      result.current.start('/api/test', { prompt: 'hello' });
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.text).toBe('call1');

    await act(async () => {
      result.current.retry();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.text).toBe('call2');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('handles network errors', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    const onError = vi.fn();
    const { result } = renderHook(() => useLLMStream({ onError }));

    await act(async () => {
      result.current.start('/api/test', { prompt: 'hello' });
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.type).toBe('network');
    expect(result.current.isStreaming).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
  });
});
