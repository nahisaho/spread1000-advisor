import { NextResponse } from 'next/server';
import { ConfigManager, type ProviderType } from '@/infrastructure/config/ConfigManager';
import { validateEndpointUrl } from '@/lib/sanitize';

export async function GET() {
  try {
    const config = await ConfigManager.load();
    // Return config WITHOUT api keys
    return NextResponse.json({
      provider: config.llm.type,
      model: config.llm.model,
      endpoint: config.llm.endpoint ?? '',
      deploymentName: config.llm.deploymentName ?? '',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to load config' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      type?: ProviderType;
      model?: string;
      endpoint?: string;
      deploymentName?: string;
    };

    await ConfigManager.saveRuntimeConfig({
      type: body.type,
      model: body.model,
      endpoint: body.endpoint && validateEndpointUrl(body.endpoint) ? body.endpoint : undefined,
      deploymentName: body.deploymentName,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 },
    );
  }
}
