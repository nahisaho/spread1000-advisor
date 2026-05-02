import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AzureRetailPriceService } from './AzureRetailPriceService';

describe('AzureRetailPriceService', () => {
  let service: AzureRetailPriceService;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    service = new AzureRetailPriceService();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockFetch(response: unknown, ok = true, status = 200) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(response),
    });
  }

  describe('lookupPrice', () => {
    it('returns JPY price directly when currency is JPY', async () => {
      mockFetch({
        Items: [
          { retailPrice: 100, currencyCode: 'JPY', meterId: 'meter-1' },
        ],
      });

      const result = await service.lookupPrice('Virtual Machines', 'D2s v3', 'japaneast');

      expect(result.source).toBe('api');
      expect(result.unitPriceJpy).toBe(100);
      expect(result.originalCurrency).toBe('JPY');
      expect(result.originalUnitPrice).toBe(100);
      expect(result.retailPriceId).toBe('meter-1');
      expect(result.retrievedAt).toBeTruthy();
    });

    it('converts USD to JPY using exchange rate', async () => {
      mockFetch({
        Items: [
          { retailPrice: 0.5, currencyCode: 'USD', meterId: 'meter-2' },
        ],
      });

      const result = await service.lookupPrice('Virtual Machines', 'D2s v3', 'eastus');

      expect(result.source).toBe('api');
      expect(result.unitPriceJpy).toBe(0.5 * 150);
      expect(result.originalCurrency).toBe('USD');
      expect(result.originalUnitPrice).toBe(0.5);
    });

    it('returns fallback when API returns error status', async () => {
      mockFetch({}, false, 500);

      const result = await service.lookupPrice('VM', 'sku', 'region');

      expect(result.source).toBe('fallback');
      expect(result.unitPriceJpy).toBe(0);
    });

    it('returns fallback when API returns no items', async () => {
      mockFetch({ Items: [] });

      const result = await service.lookupPrice('VM', 'sku', 'region');

      expect(result.source).toBe('fallback');
      expect(result.unitPriceJpy).toBe(0);
    });

    it('returns fallback when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.lookupPrice('VM', 'sku', 'region');

      expect(result.source).toBe('fallback');
      expect(result.unitPriceJpy).toBe(0);
    });

    it('builds correct OData filter URL', async () => {
      mockFetch({ Items: [] });

      await service.lookupPrice('Virtual Machines', 'D2s v3', 'japaneast');

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = call[0] as string;
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain("serviceName eq 'Virtual Machines'");
      expect(decoded).toContain("skuName eq 'D2s v3'");
      expect(decoded).toContain("armRegionName eq 'japaneast'");
      expect(decoded).toContain("priceType eq 'Consumption'");
    });
  });

  describe('isAvailable', () => {
    it('returns true when API responds OK', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      expect(await service.isAvailable()).toBe(true);
    });

    it('returns false when API responds with error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

      expect(await service.isAvailable()).toBe(false);
    });

    it('returns false when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('timeout'));

      expect(await service.isAvailable()).toBe(false);
    });
  });
});
