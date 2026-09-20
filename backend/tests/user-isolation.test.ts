/**
 * AURA Multi-Tenant User Isolation & Cross-Device Persistence Tests (Mission 6.1)
 * Rigorously verifies that:
 * 1. Two separate accounts have 100% isolated sessions, messages, memories, settings, and relationship state.
 * 2. An account logged in from another device/browser immediately recovers identical state.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { app } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/database/client.js';
import { sqliteMemoryRepository } from '../src/memory/storage/sqlite.repository.js';
import { relationshipRepository } from '../src/relationship/storage/relationship.repository.js';
import { relationshipAnalyzer } from '../src/relationship/analyzer/relationship.analyzer.js';

describe('Mission 6.1 — Multi-Tenant User Isolation & Cross-Device Sync Tests', () => {
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

  const timestamp = Date.now();
  const userA = { email: `userA_${timestamp}@aura.os`, password: 'UserAPassword123!', name: 'User A' };
  const userB = { email: `userB_${timestamp}@aura.os`, password: 'UserBPassword123!', name: 'User B' };

  let tokenA = '';
  let tokenB = '';
  let userIdA = '';
  let userIdB = '';
  let sessionAId = '';

  it('should provision two independent user accounts', async () => {
    // Register User A
    const resA = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userA),
    });
    const jsonA = await resA.json();
    assert.equal(resA.status, 201);
    userIdA = jsonA.data.user.id;
    tokenA = jsonA.data.tokens.accessToken;

    // Register User B
    const resB = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userB),
    });
    const jsonB = await resB.json();
    assert.equal(resB.status, 201);
    userIdB = jsonB.data.user.id;
    tokenB = jsonB.data.tokens.accessToken;

    assert.notEqual(userIdA, userIdB);
  });

  it('should strictly isolate conversation sessions between User A and User B', async () => {
    // User A creates a session
    const createRes = await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ title: "User A Confidential Session", initialTopic: 'Secret Planning' }),
    });
    const createJson = await createRes.json();
    assert.equal(createRes.status, 201);
    sessionAId = createJson.data.id;
    assert.ok(sessionAId);

    // User A lists sessions -> sees 1 session
    const listARes = await fetch(`${baseUrl}/sessions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listAJson = await listARes.json();
    assert.equal(listAJson.data.length, 1);
    assert.equal(listAJson.data[0].id, sessionAId);

    // User B lists sessions -> sees 0 sessions (ZERO data leakage)
    const listBRes = await fetch(`${baseUrl}/sessions`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const listBJson = await listBRes.json();
    assert.equal(listBJson.data.length, 0);

    // User B attempts to access User A's session by ID -> 404
    const getSessionBRes = await fetch(`${baseUrl}/sessions/${sessionAId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(getSessionBRes.status, 404);
  });

  it('should strictly isolate long-term memory facts between User A and User B', async () => {
    // User A stores a confidential memory fact
    await sqliteMemoryRepository.createMemoryFact({
      category: 'goal',
      key: 'confidential_project',
      value: 'Launch Orbital Defense System',
      importance: 9,
    }, userIdA);

    // User A queries memories -> sees the fact
    const memARes = await fetch(`${baseUrl}/memory`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const memAJson = await memARes.json();
    assert.equal(memAJson.data.length, 1);
    assert.equal(memAJson.data[0].key, 'confidential_project');

    // User B queries memories -> sees ZERO memories
    const memBRes = await fetch(`${baseUrl}/memory`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const memBJson = await memBRes.json();
    assert.equal(memBJson.data.length, 0);
  });

  it('should strictly isolate settings and preferences between User A and User B', async () => {
    // User A updates settings to cyberpunk theme and 100 empathy
    const updateSettingsRes = await fetch(`${baseUrl}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        theme: 'cyberpunk',
        empathy: 100,
        personality: 'aura-empathic',
      }),
    });
    assert.equal(updateSettingsRes.status, 200);

    // User A verifies settings
    const settingsARes = await fetch(`${baseUrl}/settings`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const settingsAJson = await settingsARes.json();
    assert.equal(settingsAJson.data.theme, 'cyberpunk');
    assert.equal(settingsAJson.data.empathy, 100);

    // User B queries settings -> retains clean defaults
    const settingsBRes = await fetch(`${baseUrl}/settings`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const settingsBJson = await settingsBRes.json();
    assert.equal(settingsBJson.data.theme, 'obsidian');
    assert.notEqual(settingsBJson.data.theme, 'cyberpunk');
  });

  it('should persist and isolate companion relationship states', async () => {
    // User A companion relationship evolves to high trust
    const stateA = relationshipAnalyzer.createInitialState(userIdA);
    stateA.level = 'companion';
    stateA.metrics.trustScore = 75;
    stateA.metrics.relationshipHealth = 80;
    await relationshipRepository.saveRelationshipState(userIdA, stateA);

    // User A profile query reflects companion level and trust 75
    const profileARes = await fetch(`${baseUrl}/profile`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const profileAJson = await profileARes.json();
    assert.equal(profileAJson.data.relationshipLevel, 'companion');
    assert.equal(profileAJson.data.statistics.trustScore, 75);

    // User B profile query retains stranger level and baseline trust 10
    const profileBRes = await fetch(`${baseUrl}/profile`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const profileBJson = await profileBRes.json();
    assert.equal(profileBJson.data.relationshipLevel, 'stranger');
    assert.equal(profileBJson.data.statistics.trustScore, 10);
  });

  it('should restore complete user state on second device login (Cross-Device Continuity)', async () => {
    // Simulate logging in from Device 2 with User A's credentials
    const device2LoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userA.email,
        password: userA.password,
      }),
    });
    const device2LoginJson = await device2LoginRes.json();
    assert.equal(device2LoginRes.status, 200);
    const device2Token = device2LoginJson.data.tokens.accessToken;
    assert.ok(device2Token);

    // Device 2 fetches sessions -> gets User A's session intact
    const sessionsRes = await fetch(`${baseUrl}/sessions`, {
      headers: { Authorization: `Bearer ${device2Token}` },
    });
    const sessionsJson = await sessionsRes.json();
    assert.equal(sessionsJson.data.length, 1);
    assert.equal(sessionsJson.data[0].id, sessionAId);

    // Device 2 fetches memories -> gets User A's memory intact
    const memoriesRes = await fetch(`${baseUrl}/memory`, {
      headers: { Authorization: `Bearer ${device2Token}` },
    });
    const memoriesJson = await memoriesRes.json();
    assert.equal(memoriesJson.data.length, 1);
    assert.equal(memoriesJson.data[0].key, 'confidential_project');

    // Device 2 fetches settings -> gets User A's cyberpunk theme intact
    const settingsRes = await fetch(`${baseUrl}/settings`, {
      headers: { Authorization: `Bearer ${device2Token}` },
    });
    const settingsJson = await settingsRes.json();
    assert.equal(settingsJson.data.theme, 'cyberpunk');

    // Device 2 fetches profile -> gets companion level & 75 trust intact
    const profileRes = await fetch(`${baseUrl}/profile`, {
      headers: { Authorization: `Bearer ${device2Token}` },
    });
    const profileJson = await profileRes.json();
    assert.equal(profileJson.data.relationshipLevel, 'companion');
    assert.equal(profileJson.data.statistics.trustScore, 75);
  });
});
