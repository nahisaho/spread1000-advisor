import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'wizard.steps.finalReview': 'Final Review',
      'export.markdown': 'Markdown',
      'export.excel': 'Excel (.xlsx)',
      'export.zip': 'ZIP',
    };
    return translations[key] ?? key;
  },
}));

import { FinalReviewStep } from './FinalReviewStep';

describe('FinalReviewStep', () => {
  it('renders run checks button', () => {
    render(<FinalReviewStep projectId="test-id" />);
    expect(screen.getByTestId('run-checks-btn')).toBeDefined();
  });

  it('renders judgment display after checks', async () => {
    const mockResult = {
      mandatoryChecks: [
        { id: 'purpose-present', label: '研究目的が記載されている', passed: true },
        { id: 'ai-utilization', label: 'AI活用の妥当性が説明されている', passed: false },
      ],
      crossPhaseChecks: [],
      judgment: '🟢' as const,
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResult), { status: 200 }),
    );

    render(<FinalReviewStep projectId="test-id" />);

    const btn = screen.getByTestId('run-checks-btn');
    btn.click();

    await vi.waitFor(() => {
      expect(screen.getByTestId('judgment-display')).toBeDefined();
    });

    expect(screen.getByTestId('download-md')).toBeDefined();
    expect(screen.getByTestId('download-excel')).toBeDefined();
    expect(screen.getByTestId('download-zip')).toBeDefined();
  });
});
