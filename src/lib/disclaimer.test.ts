import { describe, it, expect } from 'vitest';
import { appendDisclaimer, DISCLAIMER_TEXT } from './disclaimer';

describe('appendDisclaimer', () => {
  it('appends disclaimer to content', () => {
    const result = appendDisclaimer('Some content');
    expect(result).toContain('Some content');
    expect(result).toContain(DISCLAIMER_TEXT);
    expect(result).toContain('免責事項');
  });

  it('does not duplicate disclaimer', () => {
    const once = appendDisclaimer('Content');
    const twice = appendDisclaimer(once);
    expect(twice).toBe(once);
  });

  it('preserves original content', () => {
    const result = appendDisclaimer('My research proposal');
    expect(result.startsWith('My research proposal')).toBe(true);
  });

  it('adds newline separation', () => {
    const result = appendDisclaimer('Content');
    expect(result).toContain('\n\n---');
  });
});

describe('DISCLAIMER_TEXT', () => {
  it('contains AI warning', () => {
    expect(DISCLAIMER_TEXT).toContain('AI');
  });

  it('does not start with newline', () => {
    expect(DISCLAIMER_TEXT.startsWith('\n')).toBe(false);
  });
});
