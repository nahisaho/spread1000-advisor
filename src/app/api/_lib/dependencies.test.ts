import { describe, it, expect, vi } from 'vitest';

vi.mock('@/infrastructure/persistence/FileProjectRepository', () => {
  const MockRepo = vi.fn(function (this: Record<string, unknown>) {
    this.list = vi.fn();
    this.get = vi.fn();
    this.create = vi.fn();
    this.updateWizardState = vi.fn();
    this.saveDeliverable = vi.fn();
    this.loadDeliverable = vi.fn();
    this.listDeliverables = vi.fn();
  });
  return { FileProjectRepository: MockRepo };
});

vi.mock('@/infrastructure/config/ConfigManager', () => ({
  ConfigManager: {
    load: vi.fn().mockResolvedValue({
      llm: { type: 'openai', apiKey: 'key', model: 'gpt-4o' },
    }),
  },
}));

vi.mock('@/infrastructure/llm/LLMProviderFactory', () => ({
  createLLMProvider: vi.fn().mockReturnValue({
    providerId: 'test',
    displayName: 'Test',
    chatCompletion: vi.fn(),
    chatCompletionStream: vi.fn(),
    testConnection: vi.fn(),
  }),
}));

vi.mock('@/infrastructure/llm/RetryableProvider', () => {
  const MockRetryable = vi.fn(function (this: Record<string, unknown>, inner: Record<string, unknown>) {
    Object.assign(this, inner);
  });
  return { RetryableProvider: MockRetryable };
});

vi.mock('@/infrastructure/cost/AzureRetailPriceService', () => {
  const MockCost = vi.fn(function (this: Record<string, unknown>) {
    this.lookupPrice = vi.fn();
    this.isAvailable = vi.fn();
  });
  return { AzureRetailPriceService: MockCost };
});

import { getProjectRepo, getLLMProvider, getCostService } from './dependencies';

describe('dependencies', () => {
  it('getProjectRepo returns a FileProjectRepository singleton', () => {
    const repo1 = getProjectRepo();
    const repo2 = getProjectRepo();
    expect(repo1).toBe(repo2);
    expect(repo1).toBeDefined();
  });

  it('getLLMProvider creates provider from config', async () => {
    const provider = await getLLMProvider();
    expect(provider).toBeDefined();
    expect(provider.providerId).toBe('test');
  });

  it('getCostService returns a singleton', () => {
    const svc1 = getCostService();
    const svc2 = getCostService();
    expect(svc1).toBe(svc2);
  });
});
