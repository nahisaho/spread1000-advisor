import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaProvider } from './OllamaProvider';

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    provider = new OllamaProvider({ model: 'llama3' });
  });

  it('has correct providerId and displayName', () => {
    expect(provider.providerId).toBe('ollama');
    expect(provider.displayName).toBe('Ollama (Local)');
  });

  it('uses default endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    });

    await provider.chatCompletion([{ role: 'user', content: 'Hi' }]);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.anything()
    );
  });

  it('uses custom endpoint', async () => {
    const customProvider = new OllamaProvider({
      endpoint: 'http://myserver:11434',
      model: 'llama3',
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    });

    await customProvider.chatCompletion([{ role: 'user', content: 'Hi' }]);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://myserver:11434/v1/chat/completions',
      expect.anything()
    );
  });

  describe('chatCompletion', () => {
    it('returns response content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Ollama response' } }],
        }),
      });

      const result = await provider.chatCompletion([
        { role: 'user', content: 'Hi' },
      ]);

      expect(result).toBe('Ollama response');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        provider.chatCompletion([{ role: 'user', content: 'Hi' }])
      ).rejects.toThrow('Ollama API error: 500 Internal Server Error');
    });
  });

  describe('listModels', () => {
    it('returns model names from /api/tags', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3:latest' },
            { name: 'codellama:7b' },
          ],
        }),
      });

      const models = await provider.listModels();

      expect(models).toEqual(['llama3:latest', 'codellama:7b']);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags'
      );
    });
  });

  describe('testConnection', () => {
    it('returns ok when listModels succeeds', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });

      const result = await provider.testConnection();
      expect(result).toEqual({ ok: true });
    });

    it('returns error when listModels fails', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await provider.testConnection();
      expect(result).toEqual({ ok: false, error: 'Connection refused' });
    });
  });
});
