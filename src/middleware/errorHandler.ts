/**
 * @fileoverview Global error handling middleware
 * Catches and normalizes errors across the application
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApiErrorResponse, ApiErrorCode } from '@/types/api.types';

// =============================================================================
// ERROR HANDLER CLASS
// =============================================================================

export class AppError extends Error {
  constructor(
    public code: ApiErrorCode,
    public statusCode: number,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// =============================================================================
// ERROR HANDLING UTILITIES
// =============================================================================

/**
 * Handle errors and return standardized API response
 */
export function handleError(error: unknown): ApiErrorResponse {
  const timestamp = new Date().toISOString();
  const requestId = crypto.randomUUID?.() || 'unknown';

  // Handle AppError
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      timestamp,
      requestId,
    };
  }

  // Handle Zod validation errors
  if (error instanceof Error && error.name === 'ZodError') {
    return {
      success: false,
      error: {
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: (error as any).errors,
      },
      timestamp,
      requestId,
    };
  }

  // Handle generic Error
  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: ApiErrorCode.INTERNAL_SERVER_ERROR,
        message: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message,
        details: process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined,
      },
      timestamp,
      requestId,
    };
  }

  // Handle unknown error
  return {
    success: false,
    error: {
      code: ApiErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
    },
    timestamp,
    requestId,
  };
}

/**
 * Create standardized error responses for common scenarios
 */
export const ErrorResponses = {
  badRequest: (message: string, details?: any) =>
    new AppError(ApiErrorCode.BAD_REQUEST, 400, message, details),

  unauthorized: (message = 'Unauthorized') =>
    new AppError(ApiErrorCode.UNAUTHORIZED, 401, message),

  forbidden: (message = 'Forbidden') =>
    new AppError(ApiErrorCode.FORBIDDEN, 403, message),

  notFound: (message = 'Resource not found') =>
    new AppError(ApiErrorCode.NOT_FOUND, 404, message),

  conflict: (message: string, details?: any) =>
    new AppError(ApiErrorCode.CONFLICT, 409, message, details),

  validationError: (message: string, details?: any) =>
    new AppError(ApiErrorCode.VALIDATION_ERROR, 400, message, details),

  fileTooLarge: (maxSize: number) =>
    new AppError(
      ApiErrorCode.FILE_TOO_LARGE,
      413,
      `File exceeds maximum size of ${maxSize} bytes`
    ),

  unsupportedFileType: (type: string, allowed: string[]) =>
    new AppError(
      ApiErrorCode.UNSUPPORTED_FILE_TYPE,
      415,
      `File type "${type}" is not supported. Allowed types: ${allowed.join(', ')}`
    ),

  rateLimitExceeded: (retryAfter?: number) =>
    new AppError(
      ApiErrorCode.RATE_LIMIT_EXCEEDED,
      429,
      'Too many requests. Please try again later.',
      retryAfter ? { retryAfter } : undefined
    ),

  operationTimeout: (operation: string) =>
    new AppError(
      ApiErrorCode.OPERATION_TIMEOUT,
      504,
      `Operation "${operation}" timed out. Please try again.`
    ),

  emailAlreadyExists: (email: string) =>
    new AppError(
      ApiErrorCode.EMAIL_ALREADY_EXISTS,
      409,
      `Email "${email}" is already registered`,
      { email }
    ),

  userNotFound: () =>
    new AppError(ApiErrorCode.USER_NOT_FOUND, 404, 'User not found'),

  postNotFound: () =>
    new AppError(ApiErrorCode.POST_NOT_FOUND, 404, 'Post not found'),

  tokenExpired: () =>
    new AppError(ApiErrorCode.TOKEN_EXPIRED, 401, 'Token has expired'),

  invalidToken: () =>
    new AppError(ApiErrorCode.INVALID_TOKEN, 401, 'Invalid or malformed token'),

  authenticationFailed: () =>
    new AppError(
      ApiErrorCode.AUTHENTICATION_FAILED,
      401,
      'Authentication failed. Invalid credentials.'
    ),

  databaseError: (message?: string) =>
    new AppError(
      ApiErrorCode.DATABASE_ERROR,
      500,
      message || 'Database operation failed'
    ),

  serviceUnavailable: (service?: string) =>
    new AppError(
      ApiErrorCode.SERVICE_UNAVAILABLE,
      503,
      service 
        ? `Service "${service}" is temporarily unavailable`
        : 'Service is temporarily unavailable'
    ),
};

// =============================================================================
// NEXT.JS ERROR HANDLER MIDDLEWARE
// =============================================================================

/**
 * Next.js error handling middleware for API routes
 * Wraps API route handlers with error catching
 */
export function withErrorHandler(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (error) {
      console.error('[API Error]', error);

      const errorResponse = handleError(error);
      const statusCode =
        error instanceof AppError ? error.statusCode : 500;

      return NextResponse.json(errorResponse, { status: statusCode });
    }
  };
}

/**
 * Express error handling middleware
 */
export function expressErrorHandler(
  err: any,
  req: any,
  res: any,
  next: any
) {
  console.error('[Express Error]', err);

  const errorResponse = handleError(err);
  const statusCode =
    err instanceof AppError ? err.statusCode : 500;

  res.status(statusCode).json(errorResponse);
}

// =============================================================================
// ERROR RECOVERY UTILITIES
// =============================================================================

/**
 * Retry logic with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Timeout wrapper for promises
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName = 'Operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            ErrorResponses.operationTimeout(operationName)
          ),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T = any>(
  json: string,
  fallback?: T
): T | null {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('JSON parse error:', error);
    return fallback ?? null;
  }
}

/**
 * Async operation with error logging
 */
export async function withErrorLogging<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[${context}] Error:`, error);
    return null;
  }
}

// =============================================================================
// VALIDATION ERROR FORMATTER
// =============================================================================

/**
 * Format Zod validation errors for API response
 */
export function formatValidationErrors(errors: any[]): Record<string, string> {
  const formatted: Record<string, string> = {};

  errors.forEach((error: any) => {
    const path = error.path?.join('.') || 'unknown';
    formatted[path] = error.message;
  });

  return formatted;
}

// =============================================================================
// LOGGING & MONITORING
// =============================================================================

/**
 * Log error with context information
 */
export function logError(
  error: unknown,
  context: {
    endpoint?: string;
    method?: string;
    userId?: string;
    requestId?: string;
    severity?: 'info' | 'warning' | 'error' | 'critical';
  } = {}
) {
  const severity = context.severity || 'error';
  const timestamp = new Date().toISOString();

  const logEntry = {
    timestamp,
    severity,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  };

  if (severity === 'critical') {
    console.error('[CRITICAL]', logEntry);
    // TODO: Send to monitoring service (Sentry, etc.)
  } else if (severity === 'error') {
    console.error('[ERROR]', logEntry);
  } else if (severity === 'warning') {
    console.warn('[WARNING]', logEntry);
  } else {
    console.log('[INFO]', logEntry);
  }
}

export default {
  AppError,
  handleError,
  ErrorResponses,
  withErrorHandler,
  expressErrorHandler,
  withRetry,
  withTimeout,
  safeJsonParse,
  withErrorLogging,
  formatValidationErrors,
  logError,
};
