import { NextResponse } from 'next/server';
import { getCostService } from '@/app/api/_lib/dependencies';
import { classifyError, type ErrorResponse } from '@/lib/errors';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const serviceName = url.searchParams.get('serviceName');
    const skuName = url.searchParams.get('skuName');
    const region = url.searchParams.get('region') ?? 'japaneast';

    if (!serviceName || !skuName) {
      return NextResponse.json(
        { error: 'serviceName and skuName are required query parameters' },
        { status: 400 },
      );
    }

    const costService = getCostService();
    const result = await costService.lookupPrice(serviceName, skuName, region);
    return NextResponse.json(result);
  } catch (error) {
    const errResponse: ErrorResponse = classifyError(error);
    return NextResponse.json(errResponse, { status: 500 });
  }
}
