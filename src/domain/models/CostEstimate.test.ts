import { describe, it, expect } from 'vitest';
import {
  DIRECT_COST_LIMIT,
  validateBudget,
  type CostEstimate,
  type CostLineItem,
} from './CostEstimate';

function makeItem(overrides: Partial<CostLineItem> = {}): CostLineItem {
  return {
    resourceName: 'VM',
    sku: 'Standard_D2s_v3',
    region: 'japaneast',
    quantity: 1,
    unit: 'hour',
    unitPrice: 100,
    monthlyTotal: 72000,
    verificationStatus: 'api_verified',
    ...overrides,
  };
}

function makeEstimate(overrides: Partial<CostEstimate> = {}): CostEstimate {
  return {
    items: [makeItem()],
    directCostTotal: 1_000_000,
    indirectCostRate: 0.3,
    indirectCostTotal: 300_000,
    grandTotal: 1_300_000,
    currency: 'JPY',
    retrievedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('CostEstimate', () => {
  describe('DIRECT_COST_LIMIT', () => {
    it('is 5,000,000', () => {
      expect(DIRECT_COST_LIMIT).toBe(5_000_000);
    });
  });

  describe('validateBudget', () => {
    it('validates a correct budget within limit', () => {
      const result = validateBudget(makeEstimate());
      expect(result.withinLimit).toBe(true);
      expect(result.indirectCorrect).toBe(true);
      expect(result.allPricesVerified).toBe(true);
      expect(result.hasUnverifiedWarning).toBe(false);
    });

    it('detects over-limit direct cost', () => {
      const result = validateBudget(makeEstimate({ directCostTotal: 6_000_000 }));
      expect(result.withinLimit).toBe(false);
    });

    it('accepts exactly at the limit', () => {
      const result = validateBudget(makeEstimate({
        directCostTotal: 5_000_000,
        indirectCostTotal: 1_500_000,
      }));
      expect(result.withinLimit).toBe(true);
      expect(result.indirectCorrect).toBe(true);
    });

    it('detects incorrect indirect cost', () => {
      const result = validateBudget(makeEstimate({
        directCostTotal: 1_000_000,
        indirectCostTotal: 500_000,
      }));
      expect(result.indirectCorrect).toBe(false);
    });

    it('accepts indirect cost within rounding tolerance', () => {
      const result = validateBudget(makeEstimate({
        directCostTotal: 1_000_000,
        indirectCostTotal: 300_000.5,
      }));
      expect(result.indirectCorrect).toBe(true);
    });

    it('detects unverified prices', () => {
      const result = validateBudget(makeEstimate({
        items: [makeItem({ verificationStatus: 'estimated' })],
      }));
      expect(result.allPricesVerified).toBe(false);
      expect(result.hasUnverifiedWarning).toBe(true);
    });

    it('handles mixed verified and estimated items', () => {
      const result = validateBudget(makeEstimate({
        items: [
          makeItem({ verificationStatus: 'api_verified' }),
          makeItem({ verificationStatus: 'estimated' }),
        ],
      }));
      expect(result.allPricesVerified).toBe(false);
      expect(result.hasUnverifiedWarning).toBe(true);
    });

    it('handles empty items array', () => {
      const result = validateBudget(makeEstimate({ items: [] }));
      expect(result.allPricesVerified).toBe(true);
      expect(result.hasUnverifiedWarning).toBe(false);
    });
  });
});
