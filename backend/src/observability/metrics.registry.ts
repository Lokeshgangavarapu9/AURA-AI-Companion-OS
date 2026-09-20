/**
 * AURA Observability & Telemetry Metrics Registry
 * Mission 6.8: Latency percentiles, AI provider token/latency tracking, voice diagnostics, and system health.
 */

import { prisma } from '../database/client.js';

export interface AiProviderMetricRecord {
  calls: number;
  errors: number;
  totalTokens: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
}

export interface MetricsSnapshot {
  timestamp: string;
  uptimeSeconds: number;
  process: {
    nodeVersion: string;
    memory: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
    };
  };
  http: {
    totalRequests: number;
    status2xx: number;
    status4xx: number;
    status5xx: number;
    latency: {
      avgMs: number;
      minMs: number;
      maxMs: number;
      p95Ms: number;
    };
  };
  aiProviders: Record<string, AiProviderMetricRecord>;
  voice: {
    activeSessions: number;
    totalTurns: number;
    errors: number;
    avgTurnDurationMs: number;
  };
  database: {
    status: 'connected' | 'degraded' | 'disconnected';
    pingLatencyMs: number;
  };
}

export class MetricsRegistry {
  private totalRequests = 0;
  private status2xx = 0;
  private status4xx = 0;
  private status5xx = 0;
  private responseTimes: number[] = [];
  private readonly maxLatencyHistory = 200;

  // AI Providers Telemetry
  private providerMetrics: Map<string, { calls: number; errors: number; totalTokens: number; totalLatencyMs: number }> = new Map();

  // Voice Diagnostics
  private activeVoiceSessions = 0;
  private totalVoiceTurns = 0;
  private voiceErrors = 0;
  private totalVoiceDurationMs = 0;

  /**
   * Records completed HTTP request telemetry
   */
  public recordHttpRequest(statusCode: number, latencyMs: number): void {
    this.totalRequests++;

    if (statusCode >= 500) {
      this.status5xx++;
    } else if (statusCode >= 400) {
      this.status4xx++;
    } else {
      this.status2xx++;
    }

    this.responseTimes.push(latencyMs);
    if (this.responseTimes.length > this.maxLatencyHistory) {
      this.responseTimes.shift();
    }
  }

  /**
   * Records AI provider inference latency and token consumption
   */
  public recordAiCall(provider: string, latencyMs: number, tokens = 0, isError = false): void {
    const existing = this.providerMetrics.get(provider) || {
      calls: 0,
      errors: 0,
      totalTokens: 0,
      totalLatencyMs: 0,
    };

    existing.calls++;
    if (isError) existing.errors++;
    existing.totalTokens += tokens;
    existing.totalLatencyMs += latencyMs;

    this.providerMetrics.set(provider, existing);
  }

  /**
   * Records voice turn processing telemetry
   */
  public recordVoiceTurn(durationMs: number, isError = false): void {
    this.totalVoiceTurns++;
    if (isError) this.voiceErrors++;
    this.totalVoiceDurationMs += durationMs;
  }

  public setVoiceActiveCount(count: number): void {
    this.activeVoiceSessions = Math.max(0, count);
  }

  /**
   * Computes comprehensive Observability snapshot
   */
  public async getMetricsReport(): Promise<MetricsSnapshot> {
    const mem = process.memoryUsage();

    // Latency calculation
    let avgMs = 0;
    let minMs = 0;
    let maxMs = 0;
    let p95Ms = 0;

    if (this.responseTimes.length > 0) {
      const sorted = [...this.responseTimes].sort((a, b) => a - b);
      minMs = sorted[0];
      maxMs = sorted[sorted.length - 1];
      const sum = sorted.reduce((acc, val) => acc + val, 0);
      avgMs = Math.round(sum / sorted.length);
      const p95Idx = Math.floor(sorted.length * 0.95);
      p95Ms = sorted[p95Idx];
    }

    // AI Providers Formatting
    const providersReport: Record<string, AiProviderMetricRecord> = {};
    for (const [provider, data] of this.providerMetrics.entries()) {
      providersReport[provider] = {
        calls: data.calls,
        errors: data.errors,
        totalTokens: data.totalTokens,
        totalLatencyMs: data.totalLatencyMs,
        avgLatencyMs: data.calls > 0 ? Math.round(data.totalLatencyMs / data.calls) : 0,
      };
    }

    // Database Ping Latency
    let dbStatus: 'connected' | 'degraded' | 'disconnected' = 'disconnected';
    let dbPingMs = 0;
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbPingMs = Date.now() - dbStart;
      dbStatus = dbPingMs > 1000 ? 'degraded' : 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      process: {
        nodeVersion: process.version,
        memory: {
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        },
      },
      http: {
        totalRequests: this.totalRequests,
        status2xx: this.status2xx,
        status4xx: this.status4xx,
        status5xx: this.status5xx,
        latency: {
          avgMs,
          minMs,
          maxMs,
          p95Ms,
        },
      },
      aiProviders: providersReport,
      voice: {
        activeSessions: this.activeVoiceSessions,
        totalTurns: this.totalVoiceTurns,
        errors: this.voiceErrors,
        avgTurnDurationMs:
          this.totalVoiceTurns > 0 ? Math.round(this.totalVoiceDurationMs / this.totalVoiceTurns) : 0,
      },
      database: {
        status: dbStatus,
        pingLatencyMs: dbPingMs,
      },
    };
  }
}

export const metricsRegistry = new MetricsRegistry();
