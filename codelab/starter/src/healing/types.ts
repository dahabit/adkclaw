export type ErrorType =
  | 'timeout'
  | 'rateLimit'
  | 'network'
  | 'auth'
  | 'notFound'
  | 'crash'
  | 'permission'
  | 'serverError'
  | 'unknown';

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  status?: number;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  context?: string;
  onRetry?: (info: { attempt: number; error: ClassifiedError; waitMs: number }) => void;
}

export interface FallbackOptions {
  context?: string;
  /** Error types that should NOT trigger fallback (e.g. auth — different model won't help). */
  skipFallbackFor?: ErrorType[];
  onFallback?: (info: { error: ClassifiedError }) => void;
}
