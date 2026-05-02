import type { ProviderType } from '@/domain/interfaces/IProjectRepository';
import type { ILLMProvider } from '@/domain/interfaces/ILLMProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AzureOpenAIProvider } from './AzureOpenAIProvider';
import { ClaudeProvider } from './ClaudeProvider';
import { OllamaProvider } from './OllamaProvider';

export interface LLMProviderConfig {
  readonly type: ProviderType;
  readonly apiKey?: string;
  readonly endpoint?: string;
  readonly model: string;
  readonly deploymentName?: string;
}

export function createLLMProvider(config: LLMProviderConfig): ILLMProvider {
  switch (config.type) {
    case 'openai':
      if (!config.apiKey) throw new Error('apiKey is required for OpenAI provider');
      return new OpenAIProvider({ apiKey: config.apiKey, model: config.model });

    case 'azure-openai':
      if (!config.apiKey) throw new Error('apiKey is required for Azure OpenAI provider');
      if (!config.endpoint) throw new Error('endpoint is required for Azure OpenAI provider');
      if (!config.deploymentName) throw new Error('deploymentName is required for Azure OpenAI provider');
      return new AzureOpenAIProvider({
        apiKey: config.apiKey,
        endpoint: config.endpoint,
        deploymentName: config.deploymentName,
      });

    case 'claude':
      if (!config.apiKey) throw new Error('apiKey is required for Claude provider');
      return new ClaudeProvider({ apiKey: config.apiKey, model: config.model });

    case 'ollama':
      return new OllamaProvider({ endpoint: config.endpoint, model: config.model });

    default:
      throw new Error(`Unknown provider type: ${config.type satisfies never}`);
  }
}
