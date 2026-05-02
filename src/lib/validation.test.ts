import { describe, it, expect } from 'vitest';
import { validateProjectName, validateBudgetInput, PROJECT_NAME_PATTERN } from './validation';

describe('validateProjectName', () => {
  it('rejects empty string', () => {
    const r = validateProjectName('');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('必須');
  });

  it('rejects forward slash', () => {
    const r = validateProjectName('foo/bar');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('パス');
  });

  it('rejects backslash', () => {
    const r = validateProjectName('foo\\bar');
    expect(r.valid).toBe(false);
  });

  it('rejects double dots', () => {
    const r = validateProjectName('foo..bar');
    expect(r.valid).toBe(false);
  });

  it('rejects names starting with hyphen', () => {
    const r = validateProjectName('-project');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('英数字');
  });

  it('rejects names starting with underscore', () => {
    expect(validateProjectName('_project').valid).toBe(false);
  });

  it('rejects too-long names (64 chars)', () => {
    const longName = 'a'.repeat(64);
    expect(validateProjectName(longName).valid).toBe(false);
  });

  it('accepts valid name', () => {
    expect(validateProjectName('my-project_1').valid).toBe(true);
  });

  it('accepts single character', () => {
    expect(validateProjectName('a').valid).toBe(true);
  });

  it('accepts max-length name (63 chars)', () => {
    const name = 'a' + 'b'.repeat(62);
    expect(validateProjectName(name).valid).toBe(true);
  });
});

describe('validateBudgetInput', () => {
  it('rejects NaN', () => {
    const r = validateBudgetInput(NaN);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('正の数値');
  });

  it('rejects negative', () => {
    expect(validateBudgetInput(-1).valid).toBe(false);
  });

  it('rejects under 100,000', () => {
    const r = validateBudgetInput(99_999);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('10万円');
  });

  it('rejects over 5,000,000', () => {
    const r = validateBudgetInput(5_000_001);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('500万円');
  });

  it('accepts 100,000 (boundary)', () => {
    expect(validateBudgetInput(100_000).valid).toBe(true);
  });

  it('accepts 5,000,000 (boundary)', () => {
    expect(validateBudgetInput(5_000_000).valid).toBe(true);
  });

  it('accepts mid-range value', () => {
    expect(validateBudgetInput(1_000_000).valid).toBe(true);
  });
});

describe('PROJECT_NAME_PATTERN', () => {
  it('is a RegExp', () => {
    expect(PROJECT_NAME_PATTERN).toBeInstanceOf(RegExp);
  });
});
