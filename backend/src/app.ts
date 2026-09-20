import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { APP_CONSTANTS } from './config/index.js';
import { requestLogger } from './middleware/request-logger.middleware.js';
import { notFoundHandler } from './middleware/not-found.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import apiV1Routes from './api/routes/index.js';

/**
 * Express Application Configuration Factory
 * Assembles security headers, request parsers, route handlers, and error middleware.
 */
export const createApp = (): Application => {
  const app = express();

  // 1. Security Headers Middleware
  app.use(helmet());

  // 2. Cross-Origin Resource Sharing (CORS) Middleware
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        return callback(null, true); // Permits Vercel domains, localhost, and custom domains
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    })
  );

  // 3. Body Parsing Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
