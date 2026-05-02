import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'wizard.actions.next': 'Next',
      'wizard.steps.contextCollection': 'Context Collection',
    };
    return translations[key] ?? key;
  },
}));

vi.mock('@/hooks/useLLMStream', () => ({
  useLLMStream: () => ({
    text: '',
    isStreaming: false,
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
  }),
}));

import { ContextCollectorStep } from './ContextCollectorStep';

describe('ContextCollectorStep', () => {
  it('renders initial input and submit button', () => {
    render(<ContextCollectorStep projectId="test-id" onComplete={vi.fn()} />);

    expect(screen.getByTestId('initial-input')).toBeDefined();
    expect(screen.getByTestId('initial-submit')).toBeDefined();
  });

  it('shows progress indicator', () => {
    render(<ContextCollectorStep projectId="test-id" onComplete={vi.fn()} />);

    const progress = screen.getByTestId('context-progress');
    expect(progress).toBeDefined();
    expect(progress.textContent).toContain('0 / 6');
  });
});
