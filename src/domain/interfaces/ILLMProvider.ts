export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ChatCompletionOptions {
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stream?: boolean;
  readonly signal?: AbortSignal;
}

export interface LLMStreamChunk {
  readonly content: string;
  readonly done: boolean;
}

export interface ILLMProvider {
  readonly providerId: string;
  readonly displayName: string;

  chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<string>;

  chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncIterable<LLMStreamChunk>;

  testConnection(): Promise<{ ok: boolean; error?: string }>;

  listModels?(): Promise<string[]>;
}
