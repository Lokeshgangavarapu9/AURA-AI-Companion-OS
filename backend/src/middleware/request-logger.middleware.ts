import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { metricsRegistry } from '../observability/metrics.registry.js';

// Extend Express Request interface to store startTime and requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

/**
 * Request Logger Middleware
 * Assigns a unique Request ID, tracks response time, and logs HTTP method, URL, status code, and latency.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.requestId = requestId;
  req.startTime = Date.now();

  // Attach requestId header to outgoing response
  res.setHeader('x-request-id', requestId);

  // Hook into response finish event to calculate total latency
  res.on('finish', () => {
    const responseTime = Date.now() - (req.startTime || Date.now());
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    metricsRegistry.recordHttpRequest(res.statusCode, responseTime);

    logger[logLevel]({
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
    }, `HTTP ${req.method} ${req.originalUrl} ${res.statusCode} - ${responseTime}ms`);
  });

  next();
};
