import { NextResponse } from 'next/server';

export async function POST(_request: Request) {
  // Placeholder: LLM providers are being implemented in parallel.
  // Once providers are wired up, this will create a temporary provider
  // instance and call testConnection().
  return NextResponse.json({
    ok: false,
    error: 'LLM providers not yet configured',
  });
}
