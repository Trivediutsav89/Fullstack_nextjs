/**
 * @fileoverview API response formatter and wrapper
 * Standardizes all API responses across the application
 */

import { ApiSuccessResponse, PaginatedResponse } from '@/types/api.types';

// =============================================================================
// RESPONSE FORMATTER CLASS
// =============================================================================

export class ResponseFormatter {
  /**
   * Format success response with data
   */
  static success<T = any>(
    data: T,
    message?: string,
    meta?: Record<string, any>
  ): ApiSuccessResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
  }

  /**
   * Format paginated response
   */
  static paginated<T = any>(
    items: T[],
    total: number,
    page: number,
    pageSize: number
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage,
      hasPreviousPage,
    };
  }

  /**
   * Format list response
   */
  static list<T = any>(items: T[], total?: number) {
    return {
      items,
      total: total ?? items.length,
      count: items.length,
    };
  }

  /**
   * Format single item response
   */
  static item<T = any>(data: T, message?: string): ApiSuccessResponse<T> {
    return this.success(data, message || 'Item retrieved successfully');
  }

  /**
   * Format created response
   */
  static created<T = any>(data: T, message?: string): ApiSuccessResponse<T> {
    return this.success(data, message || 'Resource created successfully');
  }

  /**
   * Format updated response
   */
  static updated<T = any>(data: T, message?: string): ApiSuccessResponse<T> {
    return this.success(data, message || 'Resource updated successfully');
  }

  /**
   * Format deleted response
   */
  static deleted(message = 'Resource deleted successfully'): ApiSuccessResponse<{ success: true }> {
    return this.success({ success: true }, message);
  }

  /**
   * Format bulk operation response
   */
  static bulkOperation(
    processed: number,
    total: number,
    message?: string
  ): ApiSuccessResponse<{ processed: number; total: number }> {
    return this.success(
      { processed, total },
      message || `Successfully processed ${processed}/${total} items`
    );
  }
}

// =============================================================================
// NEXT.JS RESPONSE WRAPPER
// =============================================================================

export class NextResponse {
  /**
   * Send success response
   */
  static ok<T = any>(
    data: T,
    message?: string,
    statusCode = 200
  ): Response {
    const response = ResponseFormatter.success(data, message);
    return new Response(JSON.stringify(response), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  /**
   * Send created response
   */
  static created<T = any>(data: T, message?: string): Response {
    return this.ok(data, message || 'Created', 201);
  }

  /**
   * Send paginated response
   */
  static paginated<T = any>(
    items: T[],
    total: number,
    page: number,
    pageSize: number,
    statusCode = 200
  ): Response {
    const response = ResponseFormatter.success(
      ResponseFormatter.paginated(items, total, page, pageSize)
    );
    return new Response(JSON.stringify(response), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Send file response
   */
  static file(
    buffer: Buffer,
    filename: string,
    mimeType = 'application/octet-stream'
  ): Response {
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  }

  /**
   * Send streaming response
   */
  static stream(
    data: ReadableStream<Uint8Array>,
    mimeType = 'application/octet-stream'
  ): Response {
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Transfer-Encoding': 'chunked',
      },
    });
  }

  /**
   * Send redirect response
   */
  static redirect(url: string, statusCode = 302): Response {
    return new Response(null, {
      status: statusCode,
      headers: { Location: url },
    });
  }

  /**
   * Send no content response
   */
  static noContent(): Response {
    return new Response(null, { status: 204 });
  }
}

// =============================================================================
// EXPRESS RESPONSE WRAPPER
// =============================================================================

export class ExpressResponse {
  /**
   * Send success response
   */
  static ok<T = any>(
    res: any,
    data: T,
    message?: string,
    statusCode = 200
  ) {
    const response = ResponseFormatter.success(data, message);
    return res.status(statusCode).json(response);
  }

  /**
   * Send created response
   */
  static created<T = any>(res: any, data: T, message?: string) {
    return this.ok(res, data, message || 'Created', 201);
  }

  /**
   * Send paginated response
   */
  static paginated<T = any>(
    res: any,
    items: T[],
    total: number,
    page: number,
    pageSize: number
  ) {
    const response = ResponseFormatter.success(
      ResponseFormatter.paginated(items, total, page, pageSize)
    );
    return res.status(200).json(response);
  }

  /**
   * Send file response
   */
  static file(
    res: any,
    buffer: Buffer,
    filename: string,
    mimeType = 'application/octet-stream'
  ) {
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  }

  /**
   * Send stream response
   */
  static stream(
    res: any,
    stream: NodeJS.ReadableStream,
    mimeType = 'application/octet-stream'
  ) {
    res.setHeader('Content-Type', mimeType);
    return stream.pipe(res);
  }

  /**
   * Send redirect response
   */
  static redirect(res: any, url: string, statusCode = 302) {
    return res.redirect(statusCode, url);
  }

  /**
   * Send no content response
   */
  static noContent(res: any) {
    return res.status(204).send();
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate pagination values
 */
export function calculatePagination(
  page: number = 1,
  pageSize: number = 20,
  maxPageSize = 100
) {
  const validPage = Math.max(1, page);
  const validPageSize = Math.min(Math.max(1, pageSize), maxPageSize);
  const offset = (validPage - 1) * validPageSize;

  return {
    page: validPage,
    pageSize: validPageSize,
    offset,
  };
}

/**
 * Extract cursor from pagination request
 */
export function parseCursor(cursor?: string) {
  if (!cursor) return null;

  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Encode cursor for pagination
 */
export function encodeCursor(data: Record<string, any>): string {
  const json = JSON.stringify(data);
  return Buffer.from(json, 'utf-8').toString('base64');
}

/**
 * Get response headers for caching
 */
export function getCacheHeaders(
  maxAge = 3600,
  isPublic = false
): Record<string, string> {
  const visibility = isPublic ? 'public' : 'private';
  return {
    'Cache-Control': `${visibility}, max-age=${maxAge}`,
    'ETag': `W/"${Date.now()}"`,
  };
}

/**
 * Get no-cache headers
 */
export function getNoCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
}

/**
 * Format response with timing information
 */
export function addTimingHeaders(
  startTime: number,
  headers?: Record<string, string>
): Record<string, string> {
  const duration = Date.now() - startTime;
  return {
    ...headers,
    'X-Response-Time': `${duration}ms`,
  };
}

export default {
  ResponseFormatter,
  NextResponse,
  ExpressResponse,
  calculatePagination,
  parseCursor,
  encodeCursor,
  getCacheHeaders,
  getNoCacheHeaders,
  addTimingHeaders,
};
