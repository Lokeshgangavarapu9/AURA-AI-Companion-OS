import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { app } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/database/client.js';
import { metricsRegistry } from '../src/observability/metrics.registry.js';

describe('Mission 6.8 — Observability & Monitoring Test Suite', () => {
  let server: Server;
  let baseUrl: string;
  let rootUrl: string;

  before(async () => {
    await connectDatabase();
    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    rootUrl = `http://localhost:${addr.port}`;
    baseUrl = `${rootUrl}/api/v1`;
  });

  after(async () => {
    server.close();
    await disconnectDatabase();
  });

  it('verifies x-request-id header propagation and auto-generation', async () => {
    // 1. Without custom request-id: should generate one
    const res1 = await fetch(`${baseUrl}/health`);
    assert.equal(res1.status, 200);
    const generatedId = res1.headers.get('x-request-id');
    assert.ok(generatedId, 'Must return an x-request-id header');
    assert.ok(generatedId.length >= 16);

    // 2. With client-supplied request-id: should echo it back
    const customId = 'req-custom-trace-12345';
    const res2 = await fetch(`${baseUrl}/health`, {
      headers: { 'x-request-id': customId },
    });
    assert.equal(res2.status, 200);
    assert.equal(res2.headers.get('x-request-id'), customId);
  });

  it('verifies root /health and /api/v1/health production health probes', async () => {
    // 1. Root /health
    const rootRes = await fetch(`${rootUrl}/health`);
    assert.equal(rootRes.status, 200);
    const rootBody = await rootRes.json();
    assert.equal(rootBody.status, 'ok');
    assert.equal(rootBody.database, 'connected');

    // 2. /api/v1/health
    const apiRes = await fetch(`${baseUrl}/health`);
    assert.equal(apiRes.status, 200);
    const apiBody = await apiRes.json();
    assert.equal(apiBody.status, 'ok');
    assert.equal(apiBody.database, 'connected');
    assert.ok(apiBody.uptime);
  });

  it('verifies GET /api/v1/metrics returns comprehensive telemetry', async () => {
    // Record sample provider and voice telemetry
    metricsRegistry.recordAiCall('gemini', 150, 420);
    metricsRegistry.recordAiCall('groq', 85, 210);
    metricsRegistry.recordVoiceTurn(1200);

    const res = await fetch(`${baseUrl}/metrics`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');

    const metrics = body.data;

    // HTTP metrics
    assert.ok(metrics.http.totalRequests > 0);
    assert.ok(typeof metrics.http.status2xx === 'number');
    assert.ok(typeof metrics.http.latency.avgMs === 'number');
    assert.ok(typeof metrics.http.latency.p95Ms === 'number');

    // Database metrics
    assert.equal(metrics.database.status, 'connected');
    assert.ok(typeof metrics.database.pingLatencyMs === 'number');

    // Process & Memory metrics
    assert.ok(metrics.process.memory.heapUsedMb > 0);
    assert.ok(metrics.uptimeSeconds >= 0);

    // AI Providers telemetry
    assert.ok(metrics.aiProviders.gemini);
    assert.equal(metrics.aiProviders.gemini.calls, 1);
    assert.equal(metrics.aiProviders.gemini.totalTokens, 420);

    // Voice diagnostics
    assert.ok(metrics.voice.totalTurns >= 1);
    assert.ok(metrics.voice.avgTurnDurationMs > 0);
  });
});
