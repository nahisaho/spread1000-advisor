import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstimateCostUseCase } from './EstimateCostUseCase';
import type { ILLMProvider } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { ICostService } from '@/domain/interfaces/ICostService';
import { DISCLAIMER_TEXT } from '@/lib/disclaimer';

function createMockRepo(overrides: Partial<IProjectRepository> = {}): IProjectRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateWizardState: vi.fn(),
    saveDeliverable: vi.fn(),
    loadDeliverable: vi.fn().mockResolvedValue(null),
    listDeliverables: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function createMockLLM(response: string): ILLMProvider {
  return {
    providerId: 'test',
    displayName: 'Test LLM',
    chatCompletion: vi.fn().mockResolvedValue(response),
    chatCompletionStream: vi.fn(),
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
  };
}

function createMockCostService(overrides: Partial<ICostService> = {}): ICostService {
  return {
    lookupPrice: vi.fn().mockResolvedValue({
      unitPriceJpy: 10000,
      originalCurrency: 'JPY',
      originalUnitPrice: 10000,
      source: 'api',
      retailPriceId: 'price-001',
      retrievedAt: '2024-01-01T00:00:00Z',
    }),
    isAvailable: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const SAMPLE_LLM_RESPONSE = JSON.stringify([
  {
    resourceName: 'Azure OpenAI Service',
    sku: 'S0',
    region: 'japaneast',
    quantity: 1,
    unit: '月',
    estimatedUnitPrice: 50000,
  },
  {
    resourceName: 'Azure Blob Storage',
    sku: 'Standard_LRS',
    region: 'japaneast',
    quantity: 100,
    unit: 'GB',
    estimatedUnitPrice: 3,
  },
]);

describe('EstimateCostUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads architecture and produces cost estimate', async () => {
    const repo = createMockRepo({
      loadDeliverable: vi.fn().mockResolvedValue('# Azure Architecture\nOpenAI + Storage'),
      saveDeliverable: vi.fn(),
    });
    const llm = createMockLLM(SAMPLE_LLM_RESPONSE);
    const costService = createMockCostService();

    const useCase = new EstimateCostUseCase(llm, repo, costService);
    const result = await useCase.execute('proj-1');

    expect(result.items).toHaveLength(2);
    expect(result.currency).toBe('JPY');
    expect(result.indirectCostRate).toBe(0.3);
    expect(repo.loadDeliverable).toHaveBeenCalledWith('proj-1', 'phase1-azure-architecture.md');
  });

  it('throws when architecture not found', async () => {
    const repo = createMockRepo();
    const llm = createMockLLM('[]');
    const costService = createMockCostService();

    const useCase = new EstimateCostUseCase(llm, repo, costService);
    await expect(useCase.execute('proj-1')).rejects.toThrow('Azure architecture not found');
  });

  it('calls costService.lookupPrice for each resource', async () => {
    const repo = createMockRepo({
      loadDeliverable: vi.fn().mockResolvedValue('# Arch'),
      saveDeliverable: vi.fn(),
    });
    const llm = createMockLLM(SAMPLE_LLM_RESPONSE);
    const lookupPrice = vi.fn().mockResolvedValue({
      unitPriceJpy: 8000,
      originalCurrency: 'USD',
      originalUnitPrice: 55,
      source: 'api',
      retailPriceId: 'rp-1',
      retrievedAt: '2024-01-01T00:00:00Z',
    });
    const costService = createMockCostService({ lookupPrice });

    const useCase = new EstimateCostUseCase(llm, repo, costService);
    const result = await useCase.execute('proj-1');

    expect(lookupPrice).toHaveBeenCalledTimes(2);
    expect(result.items[0].verificationStatus).toBe('api_verified');
    expect(result.items[0].unitPrice).toBe(8000);
  });

  it('handles costService failures gracefully with estimated price', async () => {
    const repo = createMockRepo({
      loadDeliverable: vi.fn().mockResolvedValue('# Arch'),
      saveDeliverable: vi.fn(),
    });
    const llm = createMockLLM(SAMPLE_LLM_RESPONSE);
    const lookupPrice = vi.fn().mockRejectedValue(new Error('API unavailable'));
    const costService = createMockCostService({ lookupPrice });

    const useCase = new EstimateCostUseCase(llm, repo, costService);
    const result = await useCase.execute('proj-1');

    expect(result.items[0].verificationStatus).toBe('estimated');
    expect(result.items[0].unitPrice).toBe(50000); // falls back to LLM estimate
  });

  it('calculates totals correctly', async () => {
    const repo = createMockRepo({
      loadDeliverable: vi.fn().mockResolvedValue('# Arch'),
      saveDeliverable: vi.fn(),
    });
    const singleResource = JSON.stringify([
      {
        resourceName: 'Azure VM',
        sku: 'Standard_D2s_v3',
        region: 'japaneast',
        quantity: 2,
        unit: '月',
        estimatedUnitPrice: 10000,
      },
    ]);
    const llm = createMockLLM(singleResource);
    const lookupPrice = vi.fn().mockResolvedValue({
      unitPriceJpy: 10000,
      originalCurrency: 'JPY',
      originalUnitPrice: 10000,
      source: 'api',
      retrievedAt: '2024-01-01T00:00:00Z',
    });
    const costService = createMockCostService({ lookupPrice });

    const useCase = new EstimateCostUseCase(llm, repo, costService);
    const result = await useCase.execute('proj-1');

    expect(result.directCostTotal).toBe(20000);
    expect(result.indirectCostTotal).toBe(6000);
    expect(result.grandTotal).toBe(26000);
  });

  it('saves cost estimate as markdown with disclaimer', async () => {
    const saveDeliverable = vi.fn();
    const repo = createMockRepo({
      loadDeliverable: vi.fn().mockResolvedValue('# Arch'),
      saveDeliverable,
    });
    const llm = createMockLLM(SAMPLE_LLM_RESPONSE);
    const costService = createMockCostService();

    const useCase = new EstimateCostUseCase(llm, repo, costService);
    await useCase.execute('proj-1');

    expect(saveDeliverable).toHaveBeenCalledWith(
      'proj-1',
      'phase2-cost-estimate.md',
      expect.stringContaining(DISCLAIMER_TEXT),
    );
  });
});
