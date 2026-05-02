import { describe, it, expect } from 'vitest';
import {
  AppError,
  TimeoutError,
  RateLimitError,
  AuthError,
  NetworkError,
  ValidationError,
  NotFoundError,
  classifyError,
  classifyHttpStatus,
  toErrorResponse,
} from './errors';

describe('Error classes', () => {
  it('AppError sets type and retryable', () => {
    const err = new AppError('test', 'network', true);
    expect(err.message).toBe('test');
    expect(err.type).toBe('network');
    expect(err.retryable).toBe(true);
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
  });

  it('TimeoutError defaults', () => {
    const err = new TimeoutError();
    expect(err.message).toBe('Request timed out');
    expect(err.type).toBe('timeout');
    expect(err.retryable).toBe(true);
    expect(err.name).toBe('TimeoutError');
  });

  it('RateLimitError defaults', () => {
    const err = new RateLimitError();
    expect(err.type).toBe('rate_limit');
    expect(err.retryable).toBe(true);
  });

  it('AuthError defaults', () => {
    const err = new AuthError();
    expect(err.type).toBe('auth');
    expect(err.retryable).toBe(false);
  });

  it('NetworkError defaults', () => {
    const err = new NetworkError();
    expect(err.type).toBe('network');
    expect(err.retryable).toBe(true);
  });

  it('ValidationError requires message', () => {
    const err = new ValidationError('bad input');
    expect(err.message).toBe('bad input');
    expect(err.type).toBe('validation');
    expect(err.retryable).toBe(false);
  });

  it('NotFoundError defaults', () => {
    const err = new NotFoundError();
    expect(err.type).toBe('not_found');
    expect(err.retryable).toBe(false);
  });
});

describe('classifyError', () => {
  it('classifies AppError subclasses', () => {
    const result = classifyError(new TimeoutError());
    expect(result.type).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('classifies RateLimitError', () => {
    const result = classifyError(new RateLimitError('custom'));
    expect(result.type).toBe('rate_limit');
    expect(result.message).toBe('custom');
  });

  it('classifies TypeError with fetch', () => {
    const result = classifyError(new TypeError('Failed to fetch'));
    expect(result.type).toBe('network');
    expect(result.retryable).toBe(true);
  });

  it('classifies AbortError', () => {
    const err = new DOMException('signal aborted', 'AbortError');
    const result = classifyError(err);
    expect(result.type).toBe('timeout');
    expect(result.retryable).toBe(false);
  });

  it('classifies unknown Error', () => {
    const result = classifyError(new Error('something'));
    expect(result.type).toBe('unknown');
    expect(result.message).toBe('something');
    expect(result.retryable).toBe(true);
  });

  it('classifies non-Error values', () => {
    const result = classifyError('string error');
    expect(result.type).toBe('unknown');
    expect(result.message).toBe('string error');
  });
});

describe('classifyHttpStatus', () => {
  it('401 → auth', () => {
    const r = classifyHttpStatus(401, 'Unauthorized');
    expect(r.type).toBe('auth');
    expect(r.retryable).toBe(false);
    expect(r.message).toBe('Unauthorized');
  });

  it('403 → auth', () => {
    expect(classifyHttpStatus(403).type).toBe('auth');
  });

  it('404 → not_found', () => {
    const r = classifyHttpStatus(404);
    expect(r.type).toBe('not_found');
    expect(r.retryable).toBe(false);
  });

  it('408 → timeout', () => {
    const r = classifyHttpStatus(408);
    expect(r.type).toBe('timeout');
    expect(r.retryable).toBe(true);
  });

  it('429 → rate_limit', () => {
    const r = classifyHttpStatus(429);
    expect(r.type).toBe('rate_limit');
    expect(r.retryable).toBe(true);
  });

  it('500 → unknown retryable', () => {
    const r = classifyHttpStatus(500);
    expect(r.type).toBe('unknown');
    expect(r.retryable).toBe(true);
  });

  it('502 → unknown retryable', () => {
    expect(classifyHttpStatus(502).retryable).toBe(true);
  });

  it('200 → unknown non-retryable', () => {
    const r = classifyHttpStatus(200);
    expect(r.type).toBe('unknown');
    expect(r.retryable).toBe(false);
  });

  it('uses default message when body not provided', () => {
    const r = classifyHttpStatus(500);
    expect(r.message).toBe('HTTP 500');
  });
});

describe('toErrorResponse', () => {
  it('delegates to classifyError', () => {
    const result = toErrorResponse(new AuthError());
    expect(result.type).toBe('auth');
  });
});
