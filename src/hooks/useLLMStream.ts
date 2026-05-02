'use client';

import { useCallback, useRef, useState } from 'react';
import { classifyError, classifyHttpStatus, type ErrorResponse } from '@/lib/errors';

export interface UseLLMStreamOptions {
  onError?: (error: ErrorResponse) => void;
}

export interface UseLLMStreamReturn {
  text: string;
  isStreaming: boolean;
  error: ErrorResponse | null;
  start: (url: string, body: Record<string, unknown>) => void;
  stop: () => void;
  retry: () => void;
  reset: () => void;
}

export function useLLMStream(options?: UseLLMStreamOptions): UseLLMStreamReturn {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<ErrorResponse | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastCallRef = useRef<{ url: string; body: Record<string, unknown> } | null>(null);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const start = useCallback(
    (url: string, body: Record<string, unknown>) => {
      // Abort any existing stream
      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      lastCallRef.current = { url, body };

      setText('');
      setError(null);
      setIsStreaming(true);

      (async () => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!response.ok) {
            const bodyText = await response.text().catch(() => undefined);
            const err = classifyHttpStatus(response.status, bodyText);
            setError(err);
            setIsStreaming(false);
            options?.onError?.(err);
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            const err: ErrorResponse = { type: 'network', message: 'No response body', retryable: true };
            setError(err);
            setIsStreaming(false);
            options?.onError?.(err);
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            // Keep the last potentially incomplete line in buffer
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;

              const jsonStr = trimmed.slice(6);
              if (jsonStr === '[DONE]') {
                setIsStreaming(false);
                return;
              }

              try {
                const chunk = JSON.parse(jsonStr) as { content?: string; done?: boolean };
                if (chunk.content) {
                  setText((prev) => prev + chunk.content);
                }
                if (chunk.done) {
                  setIsStreaming(false);
                  return;
                }
              } catch {
                // Skip malformed JSON lines
              }
            }
          }

          // Stream ended without explicit done signal
          setIsStreaming(false);
        } catch (err: unknown) {
          if (controller.signal.aborted) {
            setIsStreaming(false);
            return;
          }
          const classified = classifyError(err);
          setError(classified);
          setIsStreaming(false);
          options?.onError?.(classified);
        }
      })();
    },
    [options],
  );

  const retry = useCallback(() => {
    if (lastCallRef.current) {
      start(lastCallRef.current.url, lastCallRef.current.body);
    }
  }, [start]);

  const reset = useCallback(() => {
    setText('');
    setError(null);
  }, []);

  return { text, isStreaming, error, start, stop, retry, reset };
}
