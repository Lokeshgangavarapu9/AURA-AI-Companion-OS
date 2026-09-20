import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { APP_CONSTANTS } from './config/index.js';
import { requestLogger } from './middleware/request-logger.middleware.js';
import { notFoundHandler } from './middleware/not-found.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import apiV1Routes from './api/routes/index.js';

import { inputSanitizer } from './security/sanitizer.middleware.js';
import { apiRateLimiter, authRateLimiter } from './security/rate-limiter.middleware.js';

/**
 * Express Application Configuration Factory
 * Assembles security headers, request parsers, route handlers, and error middleware.
 */
export const createApp = (): Application => {
  const app = express();

  // 1. Security Headers Middleware (Helmet + Content Security Policy)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
          mediaSrc: ["'self'", 'blob:', 'data:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. Cross-Origin Resource Sharing (CORS) Middleware with Origin Verification
  const allowedOrigins = new Set<string>([
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ]);

  // Add production frontend URL if configured
  if (process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean).forEach((u) => allowedOrigins.add(u));
  }

  const isAllowedOrigin = (origin: string): boolean => {
    if (!origin) return true; // allow server-to-server, curl, mobile
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
    // Allow all *.vercel.app preview deployments
    if (origin.endsWith('.vercel.app') || origin === 'https://vercel.app') return true;
    return allowedOrigins.has(origin);
  };

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin || '')) {
          return callback(null, true);
        }
        return callback(new Error('Blocked by AURA CORS policy'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-test-rate-limit'],
    })
  );

  // 3. Body Parsing Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Input Sanitization (Prototype Pollution & Injection Prevention)
  app.use(inputSanitizer);

  // 5. Rate Limiting Middleware
  app.use('/api/v1/auth/login', authRateLimiter);
  app.use('/api/v1/auth/register', authRateLimiter);
  app.use('/api/v1', apiRateLimiter);

  // 4. Root Health & Deployment Probes
  app.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      service: APP_CONSTANTS.APP_NAME,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });
  app.get('/health', (req, res) => {
    import('./api/controllers/health.controller.js').then(({ getHealthStatus }) => {
      getHealthStatus(req, res);
    });
  });

  // 5. Request Logging & Latency Tracking Middleware
  app.use(requestLogger);

  // 6. API v1 Routing (/api/v1/health, etc.)
  app.use(APP_CONSTANTS.API_PREFIX, apiV1Routes);

  // 6. Global 404 Handler (unmatched routes)
  app.use(notFoundHandler);

  // 7. Global Error Handler
  app.use(errorHandler);

  return app;
};

export const app = createApp();
