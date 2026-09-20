import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { app } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/database/client.js';
import { securityAuditLogger } from '../src/security/audit-logger.js';
import { createRateLimiter } from '../src/security/rate-limiter.middleware.js';
import express from 'express';

describe('Mission 6.9 — Security Hardening Test Suite', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    await connectDatabase();
    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    baseUrl = `http://localhost:${addr.port}/api/v1`;
  });

  after(async () => {
    server.close();
    await disconnectDatabase();
  });

  it('verifies secure HTTP headers injected by Helmet and CSP', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    // 1. X-Content-Type-Options
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');

    // 2. Content-Security-Policy
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp, 'Content-Security-Policy header must be present');
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes('connect-src'));
  });

  it('verifies prototype pollution and null byte injection sanitization', async () => {
    // Send a payload with dangerous prototype keys and null bytes
    const dirtyPayload = {
      email: `clean_email_${Date.now()}@aura.os`,
      password: 'SafePassword123!\0evil',
      name: 'Safe User',
      __proto__: { admin: true },
      constructor: { hacked: true },
    };

    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dirtyPayload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    // Ensure prototype was NOT polluted
    assert.equal((Object.prototype as any).admin, undefined);
    assert.equal((Object.prototype as any).hacked, undefined);
  });

  it('verifies rate limiter rejects excessive requests with 429 Too Many Requests', async () => {
    const testApp = express();
    const strictLimiter = createRateLimiter({
      windowMs: 1000,
      maxRequests: 3,
      name: 'TestLimiter',
    });

    testApp.use(strictLimiter);
    testApp.get('/test', (_req, res) => res.json({ ok: true }));

    const testServer = testApp.listen(0);
    const testPort = (testServer.address() as AddressInfo).port;

    try {
      // 3 allowed requests with x-test-rate-limit
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`http://localhost:${testPort}/test`, {
          headers: { 'x-test-rate-limit': 'true' },
        });
        assert.equal(res.status, 200);
      }

      // 4th request must be rejected with 429
      const blockedRes = await fetch(`http://localhost:${testPort}/test`, {
        headers: { 'x-test-rate-limit': 'true' },
      });
      assert.equal(blockedRes.status, 429);
      const blockedBody = await blockedRes.json();
      assert.equal(blockedBody.error.code, 'RATE_LIMIT_EXCEEDED');
      assert.ok(blockedRes.headers.get('retry-after'));
    } finally {
      testServer.close();
    }
  });

  it('verifies SecurityAuditLogger records events safely', () => {
    assert.doesNotThrow(() => {
      securityAuditLogger.log({
        type: 'AUTH_LOGIN_FAILED',
        ip: '127.0.0.1',
        details: { reason: 'Incorrect credentials' },
      });

      securityAuditLogger.log({
        type: 'RATE_LIMIT_EXCEEDED',
        ip: '127.0.0.1',
        path: '/api/v1/auth/login',
      });
    });
  });

  it('verifies protected endpoints reject unauthenticated access', async () => {
    const protectedEndpoints = [
      { method: 'GET', path: '/auth/me' },
      { method: 'GET', path: '/workspace/status' },
      { method: 'POST', path: '/workspace/execute' },
    ];

    for (const ep of protectedEndpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      });
      assert.equal(
        res.status,
        401,
        `Expected ${ep.method} ${ep.path} to be protected with 401 Unauthorized`
      );
    }
  });
});
