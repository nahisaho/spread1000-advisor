export class AppError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export type ErrorType = 'timeout' | 'rate_limit' | 'auth' | 'network' | 'validation' | 'not_found' | 'unknown';

export class TimeoutError extends AppError {
  constructor(message = 'Request timed out') {
    super(message, 'timeout', true);
    this.name = 'TimeoutError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'rate_limit', true);
    this.name = 'RateLimitError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 'auth', false);
    this.name = 'AuthError';
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network error') {
    super(message, 'network', true);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'validation', false);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 'not_found', false);
    this.name = 'NotFoundError';
  }
}

export interface ErrorResponse {
  readonly type: ErrorType;
  readonly message: string;
  readonly retryable: boolean;
}

export function classifyError(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return { type: error.type, message: error.message, retryable: error.retryable };
  }
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return { type: 'network', message: 'Network request failed', retryable: true };
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { type: 'timeout', message: 'Request was aborted', retryable: false };
  }
  const msg = error instanceof Error ? error.message : String(error);
  return { type: 'unknown', message: msg, retryable: true };
}

export function classifyHttpStatus(status: number, body?: string): ErrorResponse {
  const message = body ?? `HTTP ${status}`;
  if (status === 401 || status === 403) return { type: 'auth', message, retryable: false };
  if (status === 404) return { type: 'not_found', message, retryable: false };
  if (status === 408) return { type: 'timeout', message, retryable: true };
  if (status === 429) return { type: 'rate_limit', message, retryable: true };
  if (status >= 500) return { type: 'unknown', message, retryable: true };
  return { type: 'unknown', message, retryable: false };
}

export function toErrorResponse(error: unknown): ErrorResponse {
  return classifyError(error);
}
