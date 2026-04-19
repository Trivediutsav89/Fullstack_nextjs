/**
 * @fileoverview Health check middleware and status monitoring
 * Provides application health status and dependency checks
 */

import { HealthCheckResponse, HealthCheckStatus } from '@/types/api.types';

// =============================================================================
// HEALTH CHECK MANAGER
// =============================================================================

interface HealthCheckDependency {
  name: string;
  check: () => Promise<boolean>;
  critical?: boolean; // If true, failure makes app unhealthy
}

class HealthCheckManager {
  private dependencies: Map<string, HealthCheckDependency> = new Map();
  private startTime: number = Date.now();
  private lastCheck: HealthCheckResponse | null = null;
  private checkInterval: number = 30000; // 30 seconds

  constructor() {
    // Register default checks
    this.registerDependency('database', this.checkDatabase.bind(this), true);
    this.registerDependency('fileSystem', this.checkFileSystem.bind(this), true);

    // Start periodic health checks
    this.startPeriodicChecks();
  }

  /**
   * Register a health check dependency
   */
  registerDependency(
    name: string,
    check: () => Promise<boolean>,
    critical: boolean = false
  ): void {
    this.dependencies.set(name, { name, check, critical });
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<boolean> {
    try {
      // TODO: Implement actual database health check
      // For SQLite: check if database file exists and is readable
      // For PostgreSQL/MySQL: execute a simple query like SELECT 1
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Check file system access
   */
  private async checkFileSystem(): Promise<boolean> {
    try {
      const fs = await import('fs').then((m) => m.promises);
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      await fs.access(uploadDir);
      return true;
    } catch (error) {
      console.error('File system health check failed:', error);
      return false;
    }
  }

  /**
   * Check Redis connectivity (optional)
   */
  private async checkRedis(): Promise<boolean> {
    try {
      if (!process.env.REDIS_URL) return true; // Redis not configured
      // TODO: Implement Redis health check
      // const redis = new Redis(process.env.REDIS_URL);
      // await redis.ping();
      // return true;
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Check external APIs
   */
  private async checkExternalApis(): Promise<Record<string, HealthCheckStatus>> {
    const externalApis: Record<string, HealthCheckStatus> = {};

    // Check Sendgrid
    if (process.env.SENDGRID_API_KEY) {
      externalApis['sendgrid'] = await this.checkApiEndpoint(
        'https://api.sendgrid.com/v3/mail/send',
        'sendgrid'
      );
    }

    // Check Google Analytics (if configured)
    if (process.env.GOOGLE_ANALYTICS_ID) {
      externalApis['google-analytics'] = {
        status: 'ok',
        message: 'Google Analytics tracking ID configured',
        lastChecked: new Date().toISOString(),
      };
    }

    return externalApis;
  }

  /**
   * Check if an external API endpoint is reachable
   */
  private async checkApiEndpoint(url: string, name: string): Promise<HealthCheckStatus> {
    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        timeout: 5000,
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = response.status < 500;

      return {
        status: isHealthy ? 'ok' : 'error',
        message: `${name} returned status ${response.status}`,
        responseTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'error',
        message: `${name} check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Perform all health checks
   */
  async checkHealth(): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    const checks: HealthCheckResponse['checks'] = {
      database: { status: 'ok', message: 'Not checked', lastChecked: new Date().toISOString() },
      fileSystem: { status: 'ok', message: 'Not checked', lastChecked: new Date().toISOString() },
    };

    let hasErrors = false;
    let hasCriticalErrors = false;

    // Run dependency checks
    for (const [name, dependency] of this.dependencies) {
      const checkStartTime = Date.now();
      try {
        const isHealthy = await dependency.check();
        const responseTime = Date.now() - checkStartTime;

        if (name === 'database' || name === 'fileSystem') {
          checks[name as keyof typeof checks] = {
            status: isHealthy ? 'ok' : 'error',
            message: isHealthy ? `${name} is operational` : `${name} check failed`,
            responseTime,
            lastChecked: new Date().toISOString(),
          };
        }

        if (!isHealthy) {
          hasErrors = true;
          if (dependency.critical) {
            hasCriticalErrors = true;
          }
        }
      } catch (error) {
        hasErrors = true;
        if (dependency.critical) {
          hasCriticalErrors = true;
        }

        if (name === 'database' || name === 'fileSystem') {
          checks[name as keyof typeof checks] = {
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            lastChecked: new Date().toISOString(),
          };
        }
      }
    }

    // Check external APIs
    checks.externalApis = await this.checkExternalApis();

    const responseTime = Date.now() - startTime;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (hasCriticalErrors) {
      status = 'unhealthy';
    } else if (hasErrors) {
      status = 'degraded';
    }

    const response: HealthCheckResponse = {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      checks,
      environment: process.env.NODE_ENV || 'development',
    };

    this.lastCheck = response;
    return response;
  }

  /**
   * Get the last health check result (cached)
   */
  getLastCheck(): HealthCheckResponse | null {
    return this.lastCheck;
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicChecks(): void {
    setInterval(() => {
      this.checkHealth().catch((error) => {
        console.error('Periodic health check failed:', error);
      });
    }, this.checkInterval);
  }

  /**
   * Set the interval for periodic checks (in milliseconds)
   */
  setCheckInterval(interval: number): void {
    this.checkInterval = interval;
  }

  /**
   * Get application uptime
   */
  getUptime(): { ms: number; formatted: string } {
    const ms = Date.now() - this.startTime;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let formatted = '';
    if (days > 0) formatted += `${days}d `;
    if (hours % 24 > 0) formatted += `${hours % 24}h `;
    if (minutes % 60 > 0) formatted += `${minutes % 60}m `;
    formatted += `${seconds % 60}s`;

    return { ms, formatted };
  }

  /**
   * Reset application start time (for testing)
   */
  reset(): void {
    this.startTime = Date.now();
    this.lastCheck = null;
  }
}

// Create singleton instance
export const healthCheckManager = new HealthCheckManager();

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

/**
 * Express middleware for health check endpoint
 */
export async function healthCheckMiddleware(req: any, res: any, next: any) {
  if (req.path === '/health' || req.path === '/health/live' || req.path === '/health/ready') {
    return handleHealthCheck(req, res);
  }
  next();
}

/**
 * Health check endpoint handler
 */
async function handleHealthCheck(req: any, res: any) {
  try {
    const health = await healthCheckManager.checkHealth();

    const statusCode =
      health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// =============================================================================
// NEXT.JS API ROUTE HANDLER
// =============================================================================

/**
 * Next.js API route handler for health check
 * Usage: app/api/health/route.ts
 */
export async function healthCheckApiRoute(req: Request) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
    });
  }

  try {
    const health = await healthCheckManager.checkHealth();

    const statusCode =
      health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 503;

    return new Response(JSON.stringify(health), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format uptime for human-readable display
 */
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let result = '';
  if (days > 0) result += `${days} day${days > 1 ? 's' : ''} `;
  if (hours % 24 > 0) result += `${hours % 24} hour${hours % 24 > 1 ? 's' : ''} `;
  if (minutes % 60 > 0) result += `${minutes % 60} minute${minutes % 60 > 1 ? 's' : ''} `;
  result += `${seconds % 60} second${seconds % 60 !== 1 ? 's' : ''}`;

  return result;
}

/**
 * Get memory usage statistics
 */
export function getMemoryStats() {
  const memUsage = process.memoryUsage();
  return {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    external: Math.round(memUsage.external / 1024 / 1024), // MB
    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
  };
}

/**
 * Get CPU usage (requires os module)
 */
export function getCpuUsage() {
  const usage = process.cpuUsage();
  return {
    user: usage.user / 1000, // Convert to milliseconds
    system: usage.system / 1000,
  };
}

export default healthCheckManager;
