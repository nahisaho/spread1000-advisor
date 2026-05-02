import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LLMSettingsForm } from './LLMSettingsForm';

describe('LLMSettingsForm', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Mock GET /api/settings
    globalThis.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.endsWith('/api/settings') || urlStr === '/api/settings') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              provider: 'openai',
              model: 'gpt-4o',
              endpoint: '',
              deploymentName: '',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders provider dropdown', async () => {
    render(<LLMSettingsForm />);
    const select = screen.getByLabelText('LLM Provider');
    expect(select).toBeDefined();
    expect(select.tagName).toBe('SELECT');
  });

  it('renders all four provider options', () => {
    render(<LLMSettingsForm />);
    const options = screen.getAllByRole('option');
    const values = options.map((o) => (o as HTMLOptionElement).value);
    expect(values).toContain('openai');
    expect(values).toContain('azure-openai');
    expect(values).toContain('claude');
    expect(values).toContain('ollama');
  });

  it('shows model field for openai by default', () => {
    render(<LLMSettingsForm />);
    expect(screen.getByLabelText('Model')).toBeDefined();
  });

  it('shows deployment name and endpoint for azure-openai', async () => {
    render(<LLMSettingsForm />);
    const select = screen.getByLabelText('LLM Provider');

    fireEvent.change(select, { target: { value: 'azure-openai' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Deployment Name')).toBeDefined();
      expect(screen.getByLabelText('Endpoint')).toBeDefined();
    });
  });

  it('shows endpoint for ollama and hides API key', async () => {
    render(<LLMSettingsForm />);
    const select = screen.getByLabelText('LLM Provider');

    fireEvent.change(select, { target: { value: 'ollama' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Endpoint')).toBeDefined();
      expect(screen.queryByLabelText('API Key')).toBeNull();
    });
  });

  it('shows API key for openai', () => {
    render(<LLMSettingsForm />);
    expect(screen.getByLabelText('API Key')).toBeDefined();
  });

  it('has test connection button', () => {
    render(<LLMSettingsForm />);
    expect(screen.getByText('Test Connection')).toBeDefined();
  });

  it('has save button', () => {
    render(<LLMSettingsForm />);
    expect(screen.getByText('Save')).toBeDefined();
  });

  it('calls /api/llm/test when test connection is clicked', async () => {
    globalThis.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/llm/test')) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ provider: 'openai', model: 'gpt-4o', endpoint: '', deploymentName: '' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }) as unknown as typeof fetch;

    render(<LLMSettingsForm />);
    const testBtn = screen.getByText('Test Connection');

    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
      expect(screen.getByText(/Connection successful/)).toBeDefined();
    });
  });

  it('shows failure message on test connection error', async () => {
    globalThis.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/llm/test')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ ok: false, error: 'LLM providers not yet configured' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ provider: 'openai', model: 'gpt-4o', endpoint: '', deploymentName: '' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }) as unknown as typeof fetch;

    render(<LLMSettingsForm />);
    fireEvent.click(screen.getByText('Test Connection'));

    await waitFor(() => {
      expect(screen.getByText(/LLM providers not yet configured/)).toBeDefined();
    });
  });
});
