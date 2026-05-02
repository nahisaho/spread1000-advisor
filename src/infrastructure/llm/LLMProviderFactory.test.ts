import { describe, it, expect } from 'vitest';

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: vi.fn() } };
      models = { list: vi.fn() };
    },
    AzureOpenAI: class MockAzureOpenAI {
      chat = { completions: { create: vi.fn() } };
    },
  };
});

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: vi.fn(), stream: vi.fn() };
    },
  };
});

import { vi } from 'vitest';
import { createLLMProvider } from './LLMProviderFactory';
import { OpenAIProvider } from './OpenAIProvider';
import { AzureOpenAIProvider } from './AzureOpenAIProvider';
import { ClaudeProvider } from './ClaudeProvider';
import { OllamaProvider } from './OllamaProvider';

describe('LLMProviderFactory', () => {
  it('creates OpenAI provider', () => {
    const provider = createLLMProvider({
      type: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4',
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.providerId).toBe('openai');
  });

  it('creates Azure OpenAI provider', () => {
    const provider = createLLMProvider({
      type: 'azure-openai',
      apiKey: 'key',
      endpoint: 'https://my.openai.azure.com',
      model: 'gpt-4',
      deploymentName: 'my-deploy',
    });
    expect(provider).toBeInstanceOf(AzureOpenAIProvider);
    expect(provider.providerId).toBe('azure-openai');
  });

  it('creates Claude provider', () => {
    const provider = createLLMProvider({
      type: 'claude',
      apiKey: 'sk-ant-test',
      model: 'claude-3-opus-20240229',
    });
    expect(provider).toBeInstanceOf(ClaudeProvider);
    expect(provider.providerId).toBe('claude');
  });

  it('creates Ollama provider', () => {
    const provider = createLLMProvider({
      type: 'ollama',
      model: 'llama3',
    });
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.providerId).toBe('ollama');
  });

  it('throws on missing apiKey for OpenAI', () => {
    expect(() =>
      createLLMProvider({ type: 'openai', model: 'gpt-4' })
    ).toThrow('apiKey is required');
  });

  it('throws on missing endpoint for Azure OpenAI', () => {
    expect(() =>
      createLLMProvider({
        type: 'azure-openai',
        apiKey: 'key',
        model: 'gpt-4',
        deploymentName: 'deploy',
      })
    ).toThrow('endpoint is required');
  });

  it('throws on missing deploymentName for Azure OpenAI', () => {
    expect(() =>
      createLLMProvider({
        type: 'azure-openai',
        apiKey: 'key',
        endpoint: 'https://test.openai.azure.com',
        model: 'gpt-4',
      })
    ).toThrow('deploymentName is required');
  });

  it('throws on unknown provider type', () => {
    expect(() =>
      createLLMProvider({ type: 'unknown' as any, model: 'test' })
    ).toThrow('Unknown provider type');
  });
});
