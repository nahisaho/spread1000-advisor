import { NextResponse } from 'next/server';
import { createLLMProvider, type LLMProviderConfig } from '@/infrastructure/llm/LLMProviderFactory';
import { classifyError, type ErrorResponse } from '@/lib/errors';
import { validateEndpointUrl } from '@/lib/sanitize';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LLMProviderConfig> & { provider?: string };

    const providerType = body.type ?? body.provider;
    if (!providerType) {
      return NextResponse.json(
        { error: 'type is required' },
        { status: 400 },
      );
    }

    if (body.endpoint && !validateEndpointUrl(body.endpoint)) {
      return NextResponse.json(
        { error: 'Invalid endpoint URL' },
        { status: 400 },
      );
    }

    const provider = createLLMProvider({
      type: providerType as LLMProviderConfig['type'],
      apiKey: body.apiKey,
      endpoint: body.endpoint,
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
