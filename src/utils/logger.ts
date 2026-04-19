/**
 * @fileoverview Structured logging utility for production applications
 * Provides consistent logging across frontend and backend
 */

// =============================================================================
// LOG LEVELS & TYPES
// =============================================================================

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  environment?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  data?: Record<string, any>;
  duration?: number; // milliseconds
  statusCode?: number;
}

// =============================================================================
// LOGGER CLASS
// =============================================================================

export class Logger {
  private static instance: Logger;
  private context: LogContext = {};
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logFormat = process.env.LOG_FORMAT || 'json';

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set global context (request ID, user ID, etc.)
   */
  setContext(context: Partial<LogContext>) {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear context
   */
  clearContext() {
    this.context = {};
  }

  /**
   * Get current context
   */
  getContext(): LogContext {
    return { ...this.context };
  }

  /**
   * Format log entry
   */
  private formatEntry(entry: LogEntry): string {
    if (this.logFormat === 'json') {
      return JSON.stringify(entry);
    }

    // Text format
    const timestamp = entry.timestamp;
    const level = entry.level;
    const message = entry.message;
    const contextStr = entry.context
      ? ` [${Object.entries(entry.context)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}]`
      : '';

    let output = `${timestamp} [${level}]${contextStr} ${message}`;

    if (entry.error) {
      output += `\nError: ${entry.error.name} - ${entry.error.message}`;
      if (this.isDevelopment && entry.error.stack) {
        output += `\nStack: ${entry.error.stack}`;
      }
    }

    if (entry.data) {
      output += `\nData: ${JSON.stringify(entry.data, null, 2)}`;
    }

    if (entry.duration !== undefined) {
      output += `\nDuration: ${entry.duration}ms`;
    }

    return output;
  }

  /**
   * Write log (override for custom transports)
   */
  private write(entry: LogEntry) {
    const formatted = this.formatEntry(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(formatted);
        break;
    }

    // TODO: Send to external logging service (Datadog, Sentry, etc.)
    // if (entry.level === LogLevel.CRITICAL || entry.level === LogLevel.ERROR) {
    //   this.sendToMonitoring(entry);
    // }
  }

  /**
   * Log at DEBUG level
   */
  debug(message: string, data?: any) {
    this.write({
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      context: this.context,
      data,
    });
  }

  /**
   * Log at INFO level
   */
  info(message: string, data?: any) {
    this.write({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message,
      context: this.context,
      data,
    });
  }

  /**
   * Log at WARN level
   */
  warn(message: string, data?: any) {
    this.write({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message,
      context: this.context,
      data,
    });
  }

  /**
   * Log at ERROR level
   */
  error(message: string, error?: Error | unknown, data?: any) {
    let errorObj;

    if (error instanceof Error) {
      errorObj = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    } else if (typeof error === 'object' && error !== null) {
      errorObj = {
        name: 'Unknown',
        message: JSON.stringify(error),
      };
    }

    this.write({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      context: this.context,
      error: errorObj,
      data,
    });
  }

  /**
   * Log at CRITICAL level
   */
  critical(message: string, error?: Error | unknown, data?: any) {
    let errorObj;

    if (error instanceof Error) {
      errorObj = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    this.write({
      timestamp: new Date().toISOString(),
      level: LogLevel.CRITICAL,
      message,
      context: this.context,
      error: errorObj,
      data,
    });

    // TODO: Send alert notifications
    // this.sendAlert(message, errorObj);
  }

  /**
   * Log API request
   */
  logRequest(method: string, path: string, data?: any) {
    this.info(`${method} ${path}`, data);
  }

  /**
   * Log API response
   */
  logResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    data?: any
  ) {
    this.write({
      timestamp: new Date().toISOString(),
      level: statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO,
      message: `${method} ${path}`,
      context: this.context,
      statusCode,
      duration,
      data,
    });
  }

  /**
   * Log database query
   */
  logDatabaseQuery(query: string, duration: number, error?: Error) {
    if (error) {
      this.error(`Database query failed: ${query}`, error, { duration });
    } else {
      if (this.isDevelopment) {
        this.debug(`Database query: ${query}`, { duration });
      }
    }
  }

  /**
   * Log authentication event
   */
  logAuth(event: 'login' | 'logout' | 'signup' | 'failed', userId?: string, data?: any) {
    const message = `Authentication: ${event}`;
    const level = event === 'failed' ? LogLevel.WARN : LogLevel.INFO;

    this.write({
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, userId },
      data,
    });
  }

  /**
   * Log performance metric
   */
  logPerformance(metric: string, value: number, unit = 'ms', threshold?: number) {
    const level = threshold && value > threshold ? LogLevel.WARN : LogLevel.INFO;

    this.write({
      timestamp: new Date().toISOString(),
      level,
      message: `Performance: ${metric}`,
      context: this.context,
      data: { value, unit, thresholdExceeded: threshold && value > threshold },
    });
  }

  /**
   * Start timing a block of code
   */
  startTimer(): () => void {
    const startTime = Date.now();
    return (label = 'Operation') => {
      const duration = Date.now() - startTime;
      this.logPerformance(label, duration);
      return duration;
    };
  }
}

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

/**
 * Express logging middleware
 */
export function expressLoggingMiddleware(req: any, res: any, next: any) {
  const logger = Logger.getInstance();
  const startTime = Date.now();

  // Set request context
  logger.setContext({
    requestId: req.id || req.get('x-request-id'),
    userId: req.user?.id,
    endpoint: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log request
  logger.logRequest(req.method, req.path);

  // Log response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    logger.logResponse(
      req.method,
      req.path,
      res.statusCode,
      duration
    );
    return originalSend.call(this, data);
  };

  next();
}

// =============================================================================
// NEXT.JS MIDDLEWARE
// =============================================================================

/**
 * Next.js logging middleware
 */
export function nextLoggingMiddleware(req: any) {
  const logger = Logger.getInstance();

  logger.setContext({
    requestId: req.headers.get('x-request-id'),
    endpoint: req.nextUrl.pathname,
    method: req.method,
    userAgent: req.headers.get('user-agent'),
  });

  return logger;
}

// =============================================================================
// SINGLETON EXPORTS
// =============================================================================

export const logger = Logger.getInstance();

export default Logger;
