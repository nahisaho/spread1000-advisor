import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, existsSync: vi.fn(() => false) };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readFile: vi.fn(), writeFile: vi.fn() };
});

import { ConfigManager } from './ConfigManager';

describe('ConfigManager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_ENDPOINT;
    delete process.env.LLM_MODEL;
    delete process.env.AZURE_DEPLOYMENT_NAME;
    delete process.env.HOST;
    delete process.env.PORT;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('defaults', () => {
    it('returns default config', () => {
      const defaults = ConfigManager.defaults();
      expect(defaults.llm.type).toBe('openai');
      expect(defaults.llm.model).toBe('gpt-4o');
      expect(defaults.server.host).toBe('127.0.0.1');
      expect(defaults.server.port).toBe(3000);
      expect(defaults.data.projectsDir).toBe('./data/projects');
    });
  });

  describe('load', () => {
    it('returns defaults when no file or env vars exist', async () => {
      const config = await ConfigManager.load();
      expect(config.llm.type).toBe('openai');
      expect(config.llm.model).toBe('gpt-4o');
      expect(config.server.host).toBe('127.0.0.1');
      expect(config.server.port).toBe(3000);
    });

    it('env vars override defaults', async () => {
      process.env.LLM_PROVIDER = 'claude';
      process.env.LLM_MODEL = 'claude-3-opus';
      process.env.LLM_API_KEY = 'sk-test-key';
      process.env.PORT = '8080';

      const config = await ConfigManager.load();
      expect(config.llm.type).toBe('claude');
      expect(config.llm.model).toBe('claude-3-opus');
      expect(config.llm.apiKey).toBe('sk-test-key');
      expect(config.server.port).toBe(8080);
    });

    it('apiKey comes only from env, never defaults', async () => {
      const config = await ConfigManager.load();
      expect(config.llm.apiKey).toBeUndefined();
    });
  });
});
