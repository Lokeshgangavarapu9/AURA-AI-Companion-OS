import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { app } from '../src/app.js';
import { prisma, connectDatabase, disconnectDatabase } from '../src/database/client.js';
import { capabilityRegistry } from '../src/capabilities/index.js';
import { workspaceTokenStorage } from '../src/capabilities/workspace/token.storage.js';

describe('Mission 6.6 — Workspace Integrations Test Suite', () => {
  let server: Server;
  let baseUrl: string;
  let authToken = '';
  let userId = '';

  before(async () => {
    await connectDatabase();
    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    baseUrl = `http://localhost:${addr.port}/api/v1`;

    // Create authenticated test user
    const email = `workspace_test_${Date.now()}@aura.os`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Password123!',
        name: 'Workspace Tester',
      }),
    });
    const regData = await regRes.json();
    userId = regData.data.user.id;
    authToken = regData.data.tokens.accessToken;
  });

  after(async () => {
    server.close();
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await disconnectDatabase();
  });

  it('verifies all 4 Workspace capabilities are registered in CapabilityRegistry', () => {
    const gmailCap = capabilityRegistry.get('workspace_gmail_read');
    assert.ok(gmailCap, 'workspace_gmail_read must be registered');
    assert.equal(gmailCap.metadata.name, 'Read Gmail Messages');

    const calCap = capabilityRegistry.get('workspace_calendar_list');
    assert.ok(calCap, 'workspace_calendar_list must be registered');

    const driveCap = capabilityRegistry.get('workspace_drive_search');
    assert.ok(driveCap, 'workspace_drive_search must be registered');

    const tasksCap = capabilityRegistry.get('workspace_tasks_list');
    assert.ok(tasksCap, 'workspace_tasks_list must be registered');
  });

  it('GET /api/v1/workspace/auth/url requires authentication and returns status', async () => {
    // 1. Unauthenticated request rejected
    const unauthRes = await fetch(`${baseUrl}/workspace/auth/url`);
    assert.equal(unauthRes.status, 401);

    // 2. Authenticated request succeeds or returns unconfigured instructions
    const authRes = await fetch(`${baseUrl}/workspace/auth/url`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(authRes.status, 200);
    const data = await authRes.json();
    assert.ok(data.status === 'ok' || data.status === 'unconfigured');
    if (data.status === 'unconfigured') {
      assert.ok(Array.isArray(data.requiredVariables));
      assert.ok(data.requiredVariables.includes('GOOGLE_CLIENT_ID'));
    }
  });

  it('GET /api/v1/workspace/status returns disconnected status for new user', async () => {
    const res = await fetch(`${baseUrl}/workspace/status`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.data.connected, false);
    assert.equal(body.data.services.gmail, false);
    assert.equal(body.data.services.calendar, false);
  });

  it('verifies WorkspaceTokenStorage safely saves and retrieves user-isolated tokens', async () => {
    const mockTokens = {
      accessToken: 'test_access_token_12345',
      refreshToken: 'test_refresh_token_67890',
      expiresAt: Date.now() + 3600000,
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly',
      tokenType: 'Bearer',
    };

    // Save tokens for user
    await workspaceTokenStorage.saveTokens(userId, mockTokens);

    // Verify token retrieval
    const retrievedToken = await workspaceTokenStorage.getValidAccessToken(userId);
    assert.equal(retrievedToken, mockTokens.accessToken);

    // Verify status updated
    const status = await workspaceTokenStorage.getConnectionStatus(userId);
    assert.equal(status.connected, true);
    assert.equal(status.services.gmail, true);
    assert.equal(status.services.calendar, true);
    assert.equal(status.services.drive, false);

    // Verify token isolation: another user has NO tokens
    const otherUserId = 'other-user-uuid-999';
    const otherToken = await workspaceTokenStorage.getValidAccessToken(otherUserId);
    assert.equal(otherToken, null, 'Other user must not see this user tokens');

    // Clean up tokens
    await workspaceTokenStorage.clearTokens(userId);
    const clearedToken = await workspaceTokenStorage.getValidAccessToken(userId);
    assert.equal(clearedToken, null);
  });

  it('POST /api/v1/workspace/execute rejects execution when user is not connected', async () => {
    const res = await fetch(`${baseUrl}/workspace/execute`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: 'gmail',
        action: 'list',
      }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'WORKSPACE_NOT_CONNECTED');
  });
});
