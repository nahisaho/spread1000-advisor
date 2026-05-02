import OpenAI from 'openai';
import type {
  ILLMProvider,
  ChatMessage,
  ChatCompletionOptions,
  LLMStreamChunk,
} from '@/domain/interfaces/ILLMProvider';

export interface OpenAIProviderConfig {
  readonly apiKey: string;
  readonly model: string;
}

export class OpenAIProvider implements ILLMProvider {
  readonly providerId = 'openai';
  readonly displayName = 'OpenAI';

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model;
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<string> {
    const response = await this.client.chat.completions.create(
      {
        model: options?.model ?? this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        stream: false,
      },
      { signal: options?.signal }
    );
    return response.choices[0]?.message?.content ?? '';
  }

  async *chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncIterable<LLMStreamChunk> {
    const stream = await this.client.chat.completions.create(
      {
        model: options?.model ?? this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        stream: true,
      },
      { signal: options?.signal }
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? '';
      const done = chunk.choices[0]?.finish_reason !== null;
      yield { content, done };
    }
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.client.models.list();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async listModels(): Promise<string[]> {
    const response = await this.client.models.list();
    const models: string[] = [];
    for await (const model of response) {
      models.push(model.id);
    }
    return models;
  }
}
