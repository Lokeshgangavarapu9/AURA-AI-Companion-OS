/**
 * AURA Authentication & Identity Integration Tests (Mission 6.1)
 * Validates registration, password hashing, login, JWT verification,
 * protected routes, and password recovery.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { app } from '../src/app.js';
import { prisma, connectDatabase, disconnectDatabase } from '../src/database/client.js';

describe('Mission 6.1 — Production Authentication Tests', () => {
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

  const testEmail = `auth_test_${Date.now()}@aura.os`;
  const testPassword = 'SecurePassword123!';
  let authToken = '';
  let userId = '';

  it('should register a new user account with isolated tenant defaults', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: 'Test Explorer',
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.status, 'ok');
    assert.ok(json.data.user.id);
    assert.equal(json.data.user.email, testEmail);
    assert.ok(json.data.tokens.accessToken);

    userId = json.data.user.id;
    authToken = json.data.tokens.accessToken;

    // Verify password is not plaintext in database
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    assert.ok(dbUser?.passwordHash);
    assert.notEqual(dbUser.passwordHash, testPassword);
    assert.ok(dbUser.passwordHash.startsWith('$2')); // bcrypt hash signature
  });

  it('should reject duplicate email registration', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'AnotherPassword456!',
        name: 'Duplicate Explorer',
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 409);
    assert.equal(json.status, 'error');
    assert.equal(json.error.code, 'EMAIL_ALREADY_EXISTS');
  });

  it('should authenticate user with valid credentials and return JWT token', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.status, 'ok');
    assert.ok(json.data.tokens.accessToken);
    assert.equal(json.data.user.email, testEmail);
  });

  it('should reject login with incorrect password', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword!',
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 401);
    assert.equal(json.status, 'error');
    assert.equal(json.error.code, 'INVALID_CREDENTIALS');
  });

  it('should retrieve authenticated user profile and settings on GET /auth/me', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.status, 'ok');
    assert.equal(json.data.email, testEmail);
    assert.ok(json.data.profile);
    assert.ok(json.data.settings);
  });

  it('should reject GET /auth/me without authorization token', async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    const json = await res.json();
    assert.equal(res.status, 401);
    assert.equal(json.error.code, 'UNAUTHORIZED');
  });

  it('should process password reset workflow', async () => {
    // 1. Request password reset
    const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const forgotJson = await forgotRes.json();
    assert.equal(forgotRes.status, 200);
    const resetToken = forgotJson.data.token;
    assert.ok(resetToken);

    // 2. Complete password reset
    const newPassword = 'NewSecretPassword789!';
    const resetRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        newPassword,
      }),
    });
    const resetJson = await resetRes.json();
    assert.equal(resetRes.status, 200);
    assert.equal(resetJson.status, 'ok');

    // 3. Login with new password
    const newLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: newPassword,
      }),
    });
    assert.equal(newLoginRes.status, 200);

    // 4. Old password must now be rejected
    const oldLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    assert.equal(oldLoginRes.status, 401);
  });
});
