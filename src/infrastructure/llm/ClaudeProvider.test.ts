import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMessagesCreate = vi.fn();
const mockMessagesStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockMessagesCreate,
        stream: mockMessagesStream,
      };
    },
  };
});

import { ClaudeProvider } from './ClaudeProvider';

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ClaudeProvider({
      apiKey: 'test-key',
      model: 'claude-3-opus-20240229',
    });
  });

  it('has correct providerId and displayName', () => {
    expect(provider.providerId).toBe('claude');
    expect(provider.displayName).toBe('Claude (Anthropic)');
  });

  describe('chatCompletion', () => {
    it('returns response content', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello from Claude!' }],
      });

      const result = await provider.chatCompletion([
        { role: 'user', content: 'Hi' },
      ]);

      expect(result).toBe('Hello from Claude!');
    });

    it('extracts system prompt from messages', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
      });

      await provider.chatCompletion([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
      ]);

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful',
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        expect.anything()
      );
    });

    it('handles messages without system prompt', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
      });

      await provider.chatCompletion([
        { role: 'user', content: 'Hi' },
      ]);

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: undefined,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        expect.anything()
      );
    });

    it('uses default maxTokens of 4096', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
      });

      await provider.chatCompletion([{ role: 'user', content: 'Hi' }]);

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 4096 }),
        expect.anything()
      );
    });
  });

  describe('chatCompletionStream', () => {
    it('yields chunks from stream events', async () => {
      const events = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } },
        { type: 'message_stop' },
      ];

      mockMessagesStream.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const event of events) yield event;
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
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'pong' }],
      });
      const result = await provider.testConnection();
      expect(result).toEqual({ ok: true });
    });

    it('returns error on failure', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('Invalid API key'));
      const result = await provider.testConnection();
      expect(result).toEqual({ ok: false, error: 'Invalid API key' });
    });
  });
});
