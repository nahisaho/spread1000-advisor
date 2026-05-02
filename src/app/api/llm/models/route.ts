import { NextResponse } from 'next/server';
import { createLLMProvider, type LLMProviderConfig } from '@/infrastructure/llm/LLMProviderFactory';
import { ConfigManager } from '@/infrastructure/config/ConfigManager';
import { resolveEndpointForDocker } from '@/app/api/_lib/dependencies';
import { classifyError, type ErrorResponse } from '@/lib/errors';
import { validateEndpointUrl } from '@/lib/sanitize';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LLMProviderConfig> & { provider?: string };

    // Fall back to saved config if not provided
    const config = await ConfigManager.load();
    const providerType = body.type ?? body.provider ?? config.llm.type;
    const endpoint = resolveEndpointForDocker(body.endpoint || config.llm.endpoint);

    if (!providerType) {
      return NextResponse.json(
        { error: 'type is required' },
        { status: 400 },
      );
    }

    if (endpoint && !validateEndpointUrl(endpoint)) {
      return NextResponse.json(
        { error: 'Invalid endpoint URL' },
        { status: 400 },
      );
    }

    const provider = createLLMProvider({
      type: providerType as LLMProviderConfig['type'],
      apiKey: body.apiKey,
      endpoint,
      model: body.model ?? 'dummy',
      deploymentName: body.deploymentName,
    });

    if (!provider.listModels) {
      return NextResponse.json({ models: [] });
    }

    const models = await provider.listModels();
    return NextResponse.json({ models });
  } catch (error) {
    const errResponse: ErrorResponse = classifyError(error);
    return NextResponse.json(
      { error: errResponse.message, models: [] },
      { status: 500 },
    );
  }
}
