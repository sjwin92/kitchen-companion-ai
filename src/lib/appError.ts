export type AppErrorCode =
  | 'AUTH_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'NETWORK'
  | 'VALIDATION'
  | 'CAPABILITY_UNAVAILABLE'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(options: {
    code?: AppErrorCode;
    userMessage: string;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(options.userMessage);
    this.name = 'AppError';
    this.code = options.code ?? 'UNKNOWN';
    this.userMessage = options.userMessage;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
  }
}

export function appError(
  cause: unknown,
  userMessage: string,
  options: { code?: AppErrorCode; retryable?: boolean } = {},
) {
  if (cause instanceof AppError) return cause;
  return new AppError({
    code: options.code,
    userMessage,
    retryable: options.retryable ?? true,
    cause,
  });
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof AppError
    ? error.userMessage
    : error instanceof Error
      ? error.message
      : fallback;
}
