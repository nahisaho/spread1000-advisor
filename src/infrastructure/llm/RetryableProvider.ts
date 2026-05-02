import type {
  ILLMProvider,
  ChatMessage,
  ChatCompletionOptions,
  LLMStreamChunk,
} from '@/domain/interfaces/ILLMProvider';

export interface RetryOptions {
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  const status = (error as { status?: number }).status;

  if (status === 429) return true;
  if (status === 408) return true;
  if (status !== undefined && status >= 500) return true;

  return (
    msg.includes('timeout') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('too many requests') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RetryableProvider implements ILLMProvider {
  readonly providerId: string;
  readonly displayName: string;

  private readonly inner: ILLMProvider;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(inner: ILLMProvider, options?: RetryOptions) {
    this.inner = inner;
    this.providerId = inner.providerId;
    this.displayName = inner.displayName;
    this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<string> {
    return this.withRetry(() => this.inner.chatCompletion(messages, options));
  }

  async *chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncIterable<LLMStreamChunk> {
    yield* this.inner.chatCompletionStream(messages, options);
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    return this.inner.testConnection();
  }

  async listModels(): Promise<string[]> {
    if (!this.inner.listModels) {
      throw new Error('listModels not supported by underlying provider');
    }
    return this.withRetry(() => this.inner.listModels!());
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt === this.maxRetries) {
          throw error;
        }
        const delay = this.baseDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }

    throw lastError;
  }
}
