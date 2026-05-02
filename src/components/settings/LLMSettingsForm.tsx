'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProviderType } from '@/infrastructure/config/ConfigManager';

interface SettingsFormState {
  provider: ProviderType;
  model: string;
  endpoint: string;
  apiKey: string;
  deploymentName: string;
}

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'claude', label: 'Claude' },
  { value: 'ollama', label: 'Ollama' },
];

const DEFAULT_STATE: SettingsFormState = {
  provider: 'openai',
  model: 'gpt-4o',
  endpoint: '',
  apiKey: '',
  deploymentName: '',
};

export function LLMSettingsForm() {
  const [form, setForm] = useState<SettingsFormState>(DEFAULT_STATE);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: Partial<SettingsFormState>) => {
        setForm((prev) => ({
          ...prev,
          provider: (data.provider as ProviderType) ?? prev.provider,
          model: data.model ?? prev.model,
          endpoint: data.endpoint ?? prev.endpoint,
          deploymentName: data.deploymentName ?? prev.deploymentName,
        }));
      })
      .catch(() => {
        // Use defaults on error
      });
  }, []);

  const fetchModels = useCallback(async (provider: ProviderType, endpoint?: string, apiKey?: string) => {
    setIsLoadingModels(true);
    setAvailableModels([]);
    try {
      const res = await fetch('/api/llm/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: provider,
          endpoint: endpoint || undefined,
          apiKey: apiKey || undefined,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { models: string[] };
        setAvailableModels(data.models ?? []);
        setUseCustomModel(false);
      }
    } catch {
      // Failed to fetch — user can still type manually
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // Fetch models when provider, endpoint, or apiKey changes
  useEffect(() => {
    fetchModels(form.provider, form.endpoint, form.apiKey);
  }, [form.provider, form.endpoint, form.apiKey, fetchModels]);

  const handleChange = useCallback(
    (field: keyof SettingsFormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setTestResult(null);
      setSaveMessage('');
    },
    [],
  );

  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: form.provider,
          model: form.model,
          endpoint: form.endpoint || undefined,
          apiKey: form.apiKey || undefined,
          deploymentName: form.deploymentName || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: 'Network error' });
    } finally {
      setIsTesting(false);
    }
  }, [form]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.provider,
          model: form.model,
          endpoint: form.endpoint || undefined,
          deploymentName: form.deploymentName || undefined,
        }),
      });
      if (res.ok) {
        setSaveMessage('saved');
      } else {
        setSaveMessage('error');
      }
    } catch {
      setSaveMessage('error');
    } finally {
      setIsSaving(false);
    }
  }, [form]);

  const hasModels = availableModels.length > 0;

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div>
        <label htmlFor="provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          LLM Provider
        </label>
        <select
          id="provider"
          value={form.provider}
          onChange={(e) => handleChange('provider', e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          {PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Model — select from available or type custom */}
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Model
            </label>
            <div className="flex items-center gap-2">
              {isLoadingModels && (
                <span className="text-xs text-gray-400">Loading...</span>
              )}
              {hasModels && (
                <button
                  type="button"
                  onClick={() => setUseCustomModel(!useCustomModel)}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {useCustomModel ? '← Select from list' : 'Custom input'}
                </button>
              )}
              {!isLoadingModels && (
                <button
                  type="button"
                  onClick={() => fetchModels(form.provider, form.endpoint, form.apiKey)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  title="Refresh model list"
                >
                  ↻ Refresh
                </button>
              )}
            </div>
          </div>
          {hasModels && !useCustomModel ? (
            <select
              id="model"
              value={availableModels.includes(form.model) ? form.model : ''}
              onChange={(e) => handleChange('model', e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              {!availableModels.includes(form.model) && form.model && (
                <option value="" disabled>
                  {form.model} (not in list)
                </option>
              )}
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              id="model"
              type="text"
              value={form.model}
              onChange={(e) => handleChange('model', e.target.value)}
              placeholder={form.provider === 'ollama' ? 'llama3' : 'gpt-4o'}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          )}
        </div>

      {/* Endpoint — shown for azure-openai and ollama */}
      {(form.provider === 'azure-openai' || form.provider === 'ollama') && (
        <div>
          <label htmlFor="endpoint" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Endpoint
          </label>
          <input
            id="endpoint"
            type="text"
            value={form.endpoint}
            onChange={(e) => handleChange('endpoint', e.target.value)}
            placeholder={form.provider === 'ollama' ? 'http://localhost:11434' : 'https://your-resource.openai.azure.com'}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
      )}

      {/* Deployment Name — Azure OpenAI only */}
      {form.provider === 'azure-openai' && (
        <div>
          <label htmlFor="deploymentName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Deployment Name
          </label>
          <input
            id="deploymentName"
            type="text"
            value={form.deploymentName}
            onChange={(e) => handleChange('deploymentName', e.target.value)}
            placeholder="my-gpt-4o-deployment"
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
      )}

      {/* API Key — shown for openai, azure-openai, claude (not ollama) */}
      {form.provider !== 'ollama' && (
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            API Key
          </label>
          <input
            id="apiKey"
            type="password"
            value={form.apiKey}
            onChange={(e) => handleChange('apiKey', e.target.value)}
            placeholder="sk-..."
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            API keys are used for testing only and are not saved to config.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTesting}
          className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-500 dark:hover:bg-gray-600"
        >
          {isTesting ? 'Testing...' : 'Test Connection'}
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>

        {saveMessage === 'saved' && (
          <span className="text-sm text-green-600 dark:text-green-400">✓ Saved</span>
        )}
        {saveMessage === 'error' && (
          <span className="text-sm text-red-600 dark:text-red-400">Save failed</span>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          role="status"
          className={`rounded-md p-3 text-sm ${
            testResult.ok
              ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
          }`}
        >
          {testResult.ok ? '✓ Connection successful' : `✗ ${testResult.error ?? 'Connection failed'}`}
        </div>
      )}
    </div>
  );
}
