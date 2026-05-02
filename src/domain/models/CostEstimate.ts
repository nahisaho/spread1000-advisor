export type PriceVerificationStatus = 'api_verified' | 'estimated';

export interface CostLineItem {
  readonly resourceName: string;
  readonly sku: string;
  readonly region: string;
  readonly quantity: number;
  readonly unit: string;
  readonly unitPrice: number;
  readonly monthlyTotal: number;
  readonly verificationStatus: PriceVerificationStatus;
  readonly retailPriceId?: string;
}

export interface CostEstimate {
  readonly items: readonly CostLineItem[];
  readonly directCostTotal: number;
  readonly indirectCostRate: 0.3;
  readonly indirectCostTotal: number;
  readonly grandTotal: number;
  readonly currency: 'JPY';
  readonly retrievedAt: string | null;
}

export const DIRECT_COST_LIMIT = 5_000_000;

export interface BudgetValidation {
  readonly withinLimit: boolean;
  readonly indirectCorrect: boolean;
  readonly allPricesVerified: boolean;
  readonly hasUnverifiedWarning: boolean;
}

export function validateBudget(estimate: CostEstimate): BudgetValidation {
  return {
    withinLimit: estimate.directCostTotal <= DIRECT_COST_LIMIT,
    indirectCorrect: Math.abs(estimate.indirectCostTotal - estimate.directCostTotal * 0.3) < 1,
    allPricesVerified: estimate.items.every((i) => i.verificationStatus === 'api_verified'),
    hasUnverifiedWarning: estimate.items.some((i) => i.verificationStatus === 'estimated'),
  };
}
