export interface PriceLookupResult {
  /** Unit price normalized to JPY */
  readonly unitPriceJpy: number;
  /** Original currency from API (e.g. 'USD', 'JPY') */
  readonly originalCurrency: string;
  /** Original unit price before conversion */
  readonly originalUnitPrice: number;
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
