import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export type ProviderType = 'openai' | 'azure-openai' | 'claude' | 'ollama';

export interface LLMProviderConfig {
  readonly type: ProviderType;
  readonly apiKey?: string;
  readonly endpoint?: string;
  readonly model: string;
  readonly deploymentName?: string;
}

export interface AppConfig {
  readonly llm: LLMProviderConfig;
  readonly server: {
    readonly host: string;
    readonly port: number;
  };
  readonly data: {
    readonly projectsDir: string;
  };
}

const CONFIG_FILE = 'config.yaml';

export class ConfigManager {
  static async load(): Promise<AppConfig> {
    const defaults = this.defaults();
    const fileConfig = await this.loadFromFile();
    const envConfig = this.loadFromEnv();
    return this.merge(defaults, fileConfig, envConfig);
  }

  static async saveRuntimeConfig(updates: { type?: ProviderType; model?: string; endpoint?: string; deploymentName?: string }): Promise<void> {
    const existing = await this.loadFromFile();
    const merged = {
      ...existing,
      llm: { ...(existing?.llm ?? {}), ...updates },
    };
    // Never persist apiKey
    if (merged.llm && 'apiKey' in merged.llm) {
      delete (merged.llm as Record<string, unknown>).apiKey;
    }
    await writeFile(CONFIG_FILE, stringifyYaml(merged), 'utf-8');
  }

  static defaults(): AppConfig {
    return {
      llm: { type: 'openai', model: 'gpt-4o' },
      server: { host: '127.0.0.1', port: 3000 },
      data: { projectsDir: './data/projects' },
    };
  }

  private static async loadFromFile(): Promise<Partial<AppConfig> | null> {
    try {
      if (!existsSync(CONFIG_FILE)) return null;
      const raw = await readFile(CONFIG_FILE, 'utf-8');
      const parsed = parseYaml(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return null;
      // Strip apiKey from file config (security)
      if (parsed.llm && typeof parsed.llm === 'object' && 'apiKey' in (parsed.llm as Record<string, unknown>)) {
        delete (parsed.llm as Record<string, unknown>).apiKey;
      }
      return parsed as Partial<AppConfig>;
    } catch {
      return null;
    }
  }

  private static loadFromEnv(): Partial<AppConfig> {
    const result: Record<string, unknown> = {};
    const llm: Record<string, unknown> = {};

    if (process.env.LLM_PROVIDER) llm.type = process.env.LLM_PROVIDER;
    if (process.env.LLM_API_KEY) llm.apiKey = process.env.LLM_API_KEY;
    if (process.env.LLM_ENDPOINT) llm.endpoint = process.env.LLM_ENDPOINT;
    if (process.env.LLM_MODEL) llm.model = process.env.LLM_MODEL;
    if (process.env.AZURE_DEPLOYMENT_NAME) llm.deploymentName = process.env.AZURE_DEPLOYMENT_NAME;

    if (Object.keys(llm).length > 0) result.llm = llm;

    const server: Record<string, unknown> = {};
    if (process.env.HOST) server.host = process.env.HOST;
    if (process.env.PORT) server.port = parseInt(process.env.PORT, 10);

    if (Object.keys(server).length > 0) result.server = server;

    return result as Partial<AppConfig>;
  }

  private static merge(defaults: AppConfig, fileConfig: Partial<AppConfig> | null, envConfig: Partial<AppConfig>): AppConfig {
    const fileLlm = (fileConfig?.llm ?? {}) as Partial<LLMProviderConfig>;
    const envLlm = (envConfig.llm ?? {}) as Partial<LLMProviderConfig>;

    return {
      llm: {
        type: envLlm.type ?? fileLlm.type ?? defaults.llm.type,
        model: envLlm.model ?? fileLlm.model ?? defaults.llm.model,
        apiKey: envLlm.apiKey, // env only - never from file or defaults
        endpoint: envLlm.endpoint ?? fileLlm.endpoint ?? defaults.llm.endpoint,
        deploymentName: envLlm.deploymentName ?? fileLlm.deploymentName ?? defaults.llm.deploymentName,
      },
      server: {
        host: (envConfig.server?.host ?? fileConfig?.server?.host ?? defaults.server.host),
        port: (envConfig.server?.port ?? fileConfig?.server?.port ?? defaults.server.port),
      },
      data: {
        projectsDir: fileConfig?.data?.projectsDir ?? defaults.data.projectsDir,
      },
    };
  }
}
