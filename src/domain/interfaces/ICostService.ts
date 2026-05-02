export interface PriceLookupResult {
  readonly unitPrice: number;
  readonly currency: string;
  readonly source: 'api' | 'fallback';
  readonly retailPriceId?: string;
  readonly retrievedAt: string;
}

export interface ICostService {
  lookupPrice(
    serviceName: string,
    skuName: string,
    region: string
  ): Promise<PriceLookupResult>;

  isAvailable(): Promise<boolean>;
}
