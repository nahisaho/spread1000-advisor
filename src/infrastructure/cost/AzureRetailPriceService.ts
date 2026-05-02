import type { ICostService, PriceLookupResult } from '@/domain/interfaces/ICostService';

export class AzureRetailPriceService implements ICostService {
  private static readonly API_URL = 'https://prices.azure.com/api/retail/prices';
  private static readonly USD_TO_JPY = 150;
  private static readonly TIMEOUT_MS = 5_000;

  async lookupPrice(
    serviceName: string,
    skuName: string,
    region: string,
  ): Promise<PriceLookupResult> {
    const now = new Date().toISOString();
    try {
      const filter = [
        `serviceName eq '${serviceName}'`,
        `skuName eq '${skuName}'`,
        `armRegionName eq '${region}'`,
        `priceType eq 'Consumption'`,
      ].join(' and ');

      const url = `${AzureRetailPriceService.API_URL}?$filter=${encodeURIComponent(filter)}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(AzureRetailPriceService.TIMEOUT_MS),
      });

      if (!res.ok) {
        return AzureRetailPriceService.fallback(now);
      }

      const body = (await res.json()) as {
        Items: Array<{
          retailPrice: number;
          currencyCode: string;
          meterId: string;
        }>;
      };

      if (!body.Items || body.Items.length === 0) {
        return AzureRetailPriceService.fallback(now);
      }

      const item = body.Items[0];
      const originalCurrency = item.currencyCode;
      const originalUnitPrice = item.retailPrice;
      const unitPriceJpy =
        originalCurrency === 'JPY'
          ? originalUnitPrice
          : originalUnitPrice * AzureRetailPriceService.USD_TO_JPY;

      return {
        unitPriceJpy,
        originalCurrency,
        originalUnitPrice,
        source: 'api',
        retailPriceId: item.meterId,
        retrievedAt: now,
      };
    } catch {
      return AzureRetailPriceService.fallback(now);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(AzureRetailPriceService.API_URL, {
        method: 'HEAD',
        signal: AbortSignal.timeout(AzureRetailPriceService.TIMEOUT_MS),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private static fallback(retrievedAt: string): PriceLookupResult {
    return {
      unitPriceJpy: 0,
      originalCurrency: 'USD',
      originalUnitPrice: 0,
      source: 'fallback',
      retrievedAt,
    };
  }
}
