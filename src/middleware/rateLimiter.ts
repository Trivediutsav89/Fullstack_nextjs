/**
 * @fileoverview Rate limiting and throttling middleware
 * Prevents API abuse and ensures fair resource usage
 */

import { AppError } from '@/middleware/errorHandler';
import { ApiErrorCode } from '@/types/api.types';

// =============================================================================
// RATE LIMIT STORE INTERFACE
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator: (req: any) => string; // Function to generate rate limit key
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// =============================================================================
// IN-MEMORY RATE LIMITER
// =============================================================================

class InMemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private options: RateLimitOptions;

  constructor(options: RateLimitOptions) {
    this.options = options;

    // Cleanup expired entries periodically
    setInterval(() => {
      this.cleanup();
    }, this.options.windowMs);
  }

  /**
   * Check if request is within rate limit
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new entry or reset existing
      this.store.set(key, {
        count: 1,
        resetAt: now + this.options.windowMs,
      });
      return true;
    }

    // Increment counter
    entry.count++;

    // Check if exceeded limit
    if (entry.count > this.options.maxRequests) {
      return false;
    }

    return true;
  }

  /**
   * Get remaining requests for key
   */
  getRemaining(key: string): number {
    const entry = this.store.get(key);
    if (!entry || entry.resetAt < Date.now()) {
      return this.options.maxRequests;
    }
    return Math.max(0, this.options.maxRequests - entry.count);
  }

  /**
   * Get reset time for key
   */
  getResetTime(key: string): number {
    const entry = this.store.get(key);
    if (!entry || entry.resetAt < Date.now()) {
      return Date.now() + this.options.windowMs;
    }
    return entry.resetAt;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Reset specific key
   */
  reset(key: string) {
    this.store.delete(key);
  }

  /**
   * Reset all entries
   */
  resetAll() {
    this.store.clear();
  }
}

// =============================================================================
// RATE LIMITER FACTORY
// =============================================================================

export class RateLimiter {
  private limiter: InMemoryRateLimiter;
  private options: RateLimitOptions;

  constructor(options: RateLimitOptions) {
    this.options = {
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
      maxRequests: options.maxRequests || 100,
      keyGenerator: options.keyGenerator || ((req) => req.ip),
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      ...options,
    };

    this.limiter = new InMemoryRateLimiter(this.options);
  }

  /**
   * Express middleware
   */
  middleware() {
    return (req: any, res: any, next: any) => {
      const key = this.options.keyGenerator(req);
      
      if (!this.limiter.isAllowed(key)) {
        const remaining = this.limiter.getRemaining(key);
        const resetTime = this.limiter.getResetTime(key);
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

        res.set('RateLimit-Limit', String(this.options.maxRequests));
        res.set('RateLimit-Remaining', String(remaining));
        res.set('RateLimit-Reset', String(Math.ceil(resetTime / 1000)));
        res.set('Retry-After', String(retryAfter));

        return res.status(429).json({
          success: false,
          error: {
            code: ApiErrorCode.RATE_LIMIT_EXCEEDED,
            message: this.options.message || 'Too many requests, please try again later.',
            details: {
              retryAfter,
              resetAt: new Date(resetTime).toISOString(),
            },
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Add rate limit info to response headers
      const remaining = this.limiter.getRemaining(key);
      const resetTime = this.limiter.getResetTime(key);

      res.set('RateLimit-Limit', String(this.options.maxRequests));
      res.set('RateLimit-Remaining', String(remaining));
      res.set('RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

      next();
    };
  }

  /**
   * Next.js API route wrapper
   */
  middleware_next() {
    return async (req: any, handler: Function) => {
      const key = this.options.keyGenerator(req);

      if (!this.limiter.isAllowed(key)) {
        const remaining = this.limiter.getRemaining(key);
        const resetTime = this.limiter.getResetTime(key);
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: ApiErrorCode.RATE_LIMIT_EXCEEDED,
              message: this.options.message || 'Too many requests',
              details: { retryAfter },
            },
            timestamp: new Date().toISOString(),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'RateLimit-Limit': String(this.options.maxRequests),
              'RateLimit-Remaining': String(remaining),
              'RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
              'Retry-After': String(retryAfter),
            },
          }
        );
      }

      return handler(req);
    };
  }

  /**
   * Check if key is allowed
   */
  isAllowed(key: string): boolean {
    return this.limiter.isAllowed(key);
  }

  /**
   * Get remaining requests
   */
  getRemaining(key: string): number {
    return this.limiter.getRemaining(key);
  }

  /**
   * Reset key
   */
  reset(key: string) {
    this.limiter.reset(key);
  }

  /**
   * Reset all
   */
  resetAll() {
    this.limiter.resetAll();
  }
}

// =============================================================================
// PREDEFINED LIMITERS
// =============================================================================

/**
 * API rate limiter (100 requests per 15 minutes)
 */
export const apiLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  message: 'Too many API requests, please try again later.',
});

/**
 * Auth rate limiter (5 attempts per 15 minutes)
 */
export const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  keyGenerator: (req) => `${req.ip}-${req.body?.email || 'unknown'}`,
  message: 'Too many authentication attempts, please try again later.',
});

/**
 * Strict rate limiter (10 requests per minute)
 */
export const strictLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyGenerator: (req) => req.ip,
  message: 'Rate limit exceeded, please slow down.',
});

/**
 * Permissive rate limiter (1000 requests per hour)
 */
export const permissiveLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 1000,
  keyGenerator: (req) => req.ip,
});

// =============================================================================
// THROTTLING UTILITY
// =============================================================================

/**
 * Simple throttle function (debounce with leading/trailing)
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number,
  options?: { leading?: boolean; trailing?: boolean }
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  let lastRan: number;

  const { leading = true, trailing = true } = options || {};

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      if (leading) {
        func(...args);
      }
      inThrottle = true;
      lastRan = Date.now();

      setTimeout(() => {
        inThrottle = false;
        if (trailing && Date.now() - lastRan >= limitMs) {
          func(...args);
        }
      }, limitMs);
    }
  };
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// =============================================================================
// ADAPTIVE RATE LIMITER
// =============================================================================

/**
 * Adaptive rate limiter that adjusts based on server load
 */
export class AdaptiveRateLimiter {
  private baseLimiter: RateLimiter;
  private cpuThreshold = 0.8;
  private memoryThreshold = 0.85;

  constructor(options: RateLimitOptions) {
    this.baseLimiter = new RateLimiter(options);
  }

  /**
   * Get system load percentage
   */
  private getSystemLoad(): number {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = memUsage.heapUsed / memUsage.heapTotal;
    return heapUsedPercent;
  }

  /**
   * Check if under stress
   */
  private isUnderStress(): boolean {
    return this.getSystemLoad() > this.memoryThreshold;
  }

  /**
   * Middleware with adaptive limiting
   */
  middleware() {
    return (req: any, res: any, next: any) => {
      if (this.isUnderStress()) {
        // Reduce allowed requests when under stress
        const strictLimiter = new RateLimiter({
          windowMs: 60 * 1000,
          maxRequests: 10,
          keyGenerator: (r) => r.ip,
        });
        return strictLimiter.middleware()(req, res, next);
      }

      return this.baseLimiter.middleware()(req, res, next);
    };
  }
}

export default {
  RateLimiter,
  apiLimiter,
  authLimiter,
  strictLimiter,
  permissiveLimiter,
  throttle,
  debounce,
  AdaptiveRateLimiter,
};
