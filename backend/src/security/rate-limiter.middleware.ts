/**
 * AURA Sliding Window Rate Limiter Middleware
 * Mission 6.9: Protects authentication, chat, and API routes from brute-force and DDoS.
 */

import { Request, Response, NextFunction } from 'express';
import { securityAuditLogger } from './audit-logger.js';
import { HTTP_STATUS } from '../config/index.js';

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  name?: string;
}

interface ClientBucket {
  count: number;
  resetTime: number;
}

export const createRateLimiter = (options: RateLimiterOptions) => {
  const { windowMs, maxRequests, message = 'Too many requests. Please try again later.', name = 'General' } = options;
  const clients = new Map<string, ClientBucket>();

  // Periodically clean up stale client buckets every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of clients.entries()) {
      if (now >= bucket.resetTime) {
        clients.delete(ip);
      }
    }
  }, 300000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, skip unless testing rate limiter specifically
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    let bucket = clients.get(ip);

    if (!bucket || now >= bucket.resetTime) {
      bucket = { count: 0, resetTime: now + windowMs };
      clients.set(ip, bucket);
    }

    bucket.count++;

    const remaining = Math.max(0, maxRequests - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (bucket.count > maxRequests) {
      res.setHeader('Retry-After', resetSeconds);

      securityAuditLogger.log({
        type: 'RATE_LIMIT_EXCEEDED',
        ip,
        path: req.originalUrl,
        details: { limiter: name, count: bucket.count, maxRequests },
      });

      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        status: 'error',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfterSeconds: resetSeconds,
        },
      });
      return;
    }

    next();
  };
};

/** Strict limiter for sensitive authentication endpoints (prevent brute-force password guessing) */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 25,
  name: 'AuthLimiter',
  message: 'Too many login or registration attempts. Please wait 15 minutes before trying again.',
});

/** General API rate limiter */
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 300,
  name: 'ApiLimiter',
  message: 'API rate limit exceeded. Please throttle your requests.',
});
