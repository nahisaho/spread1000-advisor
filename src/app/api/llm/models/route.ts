import { NextResponse } from 'next/server';
import { createLLMProvider, type LLMProviderConfig } from '@/infrastructure/llm/LLMProviderFactory';
import { ConfigManager } from '@/infrastructure/config/ConfigManager';
import { resolveEndpointForDocker } from '@/app/api/_lib/dependencies';
import { classifyError, type ErrorResponse } from '@/lib/errors';
import { validateEndpointUrl } from '@/lib/sanitize';

const WELL_KNOWN_MODELS: Record<string, string[]> = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'o1',
    'o1-mini',
    'o3-mini',
  ],
  'azure-openai': [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-35-turbo',
  ],
  claude: [
    'claude-sonnet-4-20250514',
    'claude-haiku-4-20250414',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ],
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LLMProviderConfig> & { provider?: string };

    const config = await ConfigManager.load();
    const providerType = body.type ?? body.provider ?? config.llm.type;
    const endpoint = resolveEndpointForDocker(body.endpoint || config.llm.endpoint);
    const apiKey = body.apiKey || config.llm.apiKey;

    if (!providerType) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    if (endpoint && !validateEndpointUrl(endpoint)) {
      return NextResponse.json({ error: 'Invalid endpoint URL' }, { status: 400 });
    }

    // Try dynamic model list if we have credentials
    const needsApiKey = providerType !== 'ollama';
    if (!needsApiKey || apiKey) {
      try {
        const provider = createLLMProvider({
          type: providerType as LLMProviderConfig['type'],
          apiKey,
          endpoint,
          model: body.model ?? 'dummy',
          deploymentName: body.deploymentName ?? 'dummy',
        });

        if (provider.listModels) {
          const models = await provider.listModels();
          if (models.length > 0) {
            return NextResponse.json({ models, source: 'dynamic' });
          }
        }
      } catch {
        // Fall through to well-known list
      }
    }

    // Fallback: well-known models
    const fallback = WELL_KNOWN_MODELS[providerType] ?? [];
    return NextResponse.json({ models: fallback, source: 'well-known' });
  } catch (error) {
    const errResponse: ErrorResponse = classifyError(error);
    return NextResponse.json(
      { error: errResponse.message, models: [] },
      { status: 500 },
    );
  }
}
