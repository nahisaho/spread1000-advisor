import Anthropic from '@anthropic-ai/sdk';
import type {
  ILLMProvider,
  ChatMessage,
  ChatCompletionOptions,
  LLMStreamChunk,
} from '@/domain/interfaces/ILLMProvider';

export interface ClaudeProviderConfig {
  readonly apiKey: string;
  readonly model: string;
}

export class ClaudeProvider implements ILLMProvider {
  readonly providerId = 'claude';
  readonly displayName = 'Claude (Anthropic)';

  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: ClaudeProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model;
  }

  private extractSystemAndMessages(
    messages: ChatMessage[]
  ): { system: string | undefined; messages: Anthropic.MessageParam[] } {
    let system: string | undefined;
    const filtered: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
      } else {
        filtered.push({ role: msg.role, content: msg.content });
      }
    }

    return { system, messages: filtered };
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<string> {
    const { system, messages: anthropicMessages } =
      this.extractSystemAndMessages(messages);

    const response = await this.client.messages.create(
      {
        model: options?.model ?? this.model,
        max_tokens: options?.maxTokens ?? 4096,
        system,
        messages: anthropicMessages,
        temperature: options?.temperature,
      },
      { signal: options?.signal }
    );

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }

  async *chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncIterable<LLMStreamChunk> {
    const { system, messages: anthropicMessages } =
      this.extractSystemAndMessages(messages);

    const stream = this.client.messages.stream(
      {
        model: options?.model ?? this.model,
        max_tokens: options?.maxTokens ?? 4096,
        system,
        messages: anthropicMessages,
        temperature: options?.temperature,
      },
      { signal: options?.signal }
    );

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield { content: event.delta.text, done: false };
      } else if (event.type === 'message_stop') {
        yield { content: '', done: true };
      }
    }
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.chatCompletion(
        [{ role: 'user', content: 'ping' }],
        { maxTokens: 5 }
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
