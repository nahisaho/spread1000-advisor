import { NextResponse } from 'next/server';
import { createLLMProvider, type LLMProviderConfig } from '@/infrastructure/llm/LLMProviderFactory';
import { resolveEndpointForDocker } from '@/app/api/_lib/dependencies';
import { classifyError, type ErrorResponse } from '@/lib/errors';
import { validateEndpointUrl } from '@/lib/sanitize';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LLMProviderConfig> & { provider?: string };

    // Accept both 'type' and 'provider' field names
    const providerType = body.type ?? body.provider;
    if (!providerType || !body.model) {
      return NextResponse.json(
        { ok: false, error: 'type and model are required' },
        { status: 400 },
      );
    }

    const endpoint = resolveEndpointForDocker(body.endpoint);

    // Validate endpoint URL for SSRF protection
    if (endpoint && !validateEndpointUrl(endpoint)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid endpoint URL' },
        { status: 400 },
      );
    }

    const provider = createLLMProvider({
      type: providerType as LLMProviderConfig['type'],
      apiKey: body.apiKey,
      endpoint,
      model: body.model,
      deploymentName: body.deploymentName,
    });

    const result = await provider.testConnection();
    return NextResponse.json(result);
  } catch (error) {
    const errResponse: ErrorResponse = classifyError(error);
    return NextResponse.json(
      { ok: false, error: errResponse.message },
      { status: 500 },
    );
  }
}
