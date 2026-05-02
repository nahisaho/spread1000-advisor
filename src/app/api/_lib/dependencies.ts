import { FileProjectRepository } from '@/infrastructure/persistence/FileProjectRepository';
import { ConfigManager } from '@/infrastructure/config/ConfigManager';
import { createLLMProvider } from '@/infrastructure/llm/LLMProviderFactory';
import { RetryableProvider } from '@/infrastructure/llm/RetryableProvider';
import { AzureRetailPriceService } from '@/infrastructure/cost/AzureRetailPriceService';
import type { ILLMProvider } from '@/domain/interfaces/ILLMProvider';
import type { ICostService } from '@/domain/interfaces/ICostService';

let projectRepo: FileProjectRepository | null = null;

export function getProjectRepo(): FileProjectRepository {
  if (!projectRepo) {
    projectRepo = new FileProjectRepository();
  }
  return projectRepo;
}

/** In Docker (HOSTNAME=0.0.0.0), rewrite localhost to host.docker.internal */
export function resolveEndpointForDocker(endpoint: string | undefined): string | undefined {
  if (!endpoint) return undefined;
  if (process.env.HOSTNAME === '0.0.0.0') {
    return endpoint
      .replace('://localhost:', '://host.docker.internal:')
      .replace('://127.0.0.1:', '://host.docker.internal:');
  }
  return endpoint;
}

export async function getLLMProvider(): Promise<ILLMProvider> {
  const config = await ConfigManager.load();
  const baseProvider = createLLMProvider({
    ...config.llm,
    endpoint: resolveEndpointForDocker(config.llm.endpoint),
  });
  return new RetryableProvider(baseProvider);
}

let costService: AzureRetailPriceService | null = null;

export function getCostService(): ICostService {
  if (!costService) {
    costService = new AzureRetailPriceService();
  }
  return costService;
}
