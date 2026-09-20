/**
 * AURA Observability & Metrics API Routes
 * Mission 6.8: System health, request latency percentiles, provider stats, and diagnostics.
 */

import { Router, Request, Response } from 'express';
import { metricsRegistry } from '../../observability/metrics.registry.js';
import { HTTP_STATUS } from '../../config/index.js';

const metricsRouter = Router();

/**
 * GET /api/v1/metrics
 * Returns comprehensive system performance, latency percentiles, and provider metrics.
 */
metricsRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const report = await metricsRegistry.getMetricsReport();
    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: report,
    });
  } catch (error: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: { code: 'METRICS_FAILED', message: error.message },
    });
  }
});

export default metricsRouter;
