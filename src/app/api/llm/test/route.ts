import { NextResponse } from 'next/server';
import { createLLMProvider, type LLMProviderConfig } from '@/infrastructure/llm/LLMProviderFactory';
import { classifyError, type ErrorResponse } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LLMProviderConfig>;

    if (!body.type || !body.model) {
      return NextResponse.json(
        { ok: false, error: 'type and model are required' },
        { status: 400 },
      );
    }

    const provider = createLLMProvider({
      type: body.type,
      apiKey: body.apiKey,
      endpoint: body.endpoint,
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
