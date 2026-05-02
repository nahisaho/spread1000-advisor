import { describe, it, expect } from 'vitest';
import { sanitizeExcelCell, validateEndpointUrl } from './sanitize';

describe('sanitizeExcelCell', () => {
  it('escapes = prefix', () => {
    expect(sanitizeExcelCell('=SUM(A1)')).toBe("'=SUM(A1)");
  });

  it('escapes + prefix', () => {
    expect(sanitizeExcelCell('+cmd')).toBe("'+cmd");
  });

  it('escapes - prefix', () => {
    expect(sanitizeExcelCell('-cmd')).toBe("'-cmd");
  });

  it('escapes @ prefix', () => {
    expect(sanitizeExcelCell('@SUM')).toBe("'@SUM");
  });

  it('leaves safe values unchanged', () => {
    expect(sanitizeExcelCell('Hello World')).toBe('Hello World');
  });

  it('leaves numbers unchanged', () => {
    expect(sanitizeExcelCell('12345')).toBe('12345');
  });

  it('handles empty string', () => {
    expect(sanitizeExcelCell('')).toBe('');
  });
});

describe('validateEndpointUrl', () => {
  it('accepts valid https URL', () => {
    expect(validateEndpointUrl('https://api.openai.com/v1')).toBe(true);
  });

  it('accepts valid http URL', () => {
    expect(validateEndpointUrl('http://example.com')).toBe(true);
  });

  it('accepts localhost', () => {
    expect(validateEndpointUrl('http://localhost:11434')).toBe(true);
  });

  it('accepts 127.0.0.1', () => {
    expect(validateEndpointUrl('http://127.0.0.1:11434')).toBe(true);
  });

  it('rejects 10.x private IP', () => {
    expect(validateEndpointUrl('http://10.0.0.1')).toBe(false);
  });

  it('rejects 172.16.x private IP', () => {
    expect(validateEndpointUrl('http://172.16.0.1')).toBe(false);
  });

  it('rejects 172.31.x private IP', () => {
    expect(validateEndpointUrl('http://172.31.255.255')).toBe(false);
  });

  it('rejects 192.168.x private IP', () => {
    expect(validateEndpointUrl('http://192.168.1.1')).toBe(false);
  });

  it('rejects cloud metadata endpoint', () => {
    expect(validateEndpointUrl('http://169.254.169.254')).toBe(false);
  });

  it('rejects ftp protocol', () => {
    expect(validateEndpointUrl('ftp://example.com')).toBe(false);
  });

  it('rejects invalid URL', () => {
    expect(validateEndpointUrl('not-a-url')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateEndpointUrl('')).toBe(false);
  });
});
