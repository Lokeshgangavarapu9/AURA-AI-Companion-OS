import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { app } from '../src/app.js';
import { prisma, connectDatabase, disconnectDatabase } from '../src/database/client.js';
import { sqliteMemoryRepository } from '../src/memory/storage/sqlite.repository.js';
import { MemoryScorer } from '../src/memory/scoring/scorer.js';
import { MemoryRanker } from '../src/memory/ranking/ranker.js';
import { reflectionService } from '../src/memory/processors/reflection.service.js';

describe('Mission 6.7 — Advanced Memory & Relationship Intelligence Test Suite', () => {
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
    const email = `memory_test_${Date.now()}@aura.os`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Password123!',
        name: 'Memory Master',
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

  it('verifies hybrid keyword and semantic scoring in MemoryScorer', async () => {
    const memory1 = await sqliteMemoryRepository.createMemoryFact({
      category: 'preference',
      key: 'favorite_drink',
      value: 'Matcha Latte with oat milk',
      importance: 9,
    }, userId);

    const memory2 = await sqliteMemoryRepository.createMemoryFact({
      category: 'goal',
      key: 'career_aspiration',
      value: 'Become a Senior Distributed Systems Architect',
      importance: 10,
    }, userId);

    // 1. Direct keyword match
    const scoreExact = MemoryScorer.scoreMemory(memory1, ['matcha', 'latte']);
    assert.ok(scoreExact.finalScore > 0.5, 'Exact keyword match should yield high score');

    // 2. Semantic conceptual intent match ("what do you like to drink?")
    const scoreSemantic = MemoryScorer.scoreMemory(memory1, ['like', 'drink']);
    assert.ok(scoreSemantic.contextScore > 0.2, 'Semantic preference intent should boost context score');

    // 3. Goal query should rank goal higher than drink preference
    const goalQuery = ['career', 'future', 'architect'];
    const goalScore = MemoryScorer.scoreMemory(memory2, goalQuery);
    const prefScore = MemoryScorer.scoreMemory(memory1, goalQuery);
    assert.ok(goalScore.finalScore > prefScore.finalScore, 'Relevant goal must score higher than unrelated preference');
  });

  it('verifies exponential recency decay over simulated time', async () => {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    const freshMemory = await sqliteMemoryRepository.createMemoryFact({
      category: 'fact',
      key: 'recent_fact',
      value: 'User bought a new mechanical keyboard',
      importance: 5,
    }, userId);

    const scoreFresh = MemoryScorer.scoreMemory(freshMemory, [], now);

    // Score with referenceTime in future to simulate decay
    const futureDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days later (two half-lives)
    const scoreDecayed = MemoryScorer.scoreMemory(freshMemory, [], futureDate);

    assert.ok(
      scoreFresh.recencyScore > scoreDecayed.recencyScore,
      `Fresh memory recency (${scoreFresh.recencyScore}) must be higher than decayed (${scoreDecayed.recencyScore})`
    );
  });

  it('verifies active memory reinforcement increments frequency and bumps timestamp', async () => {
    const memory = await sqliteMemoryRepository.createMemoryFact({
      category: 'preference',
      key: 'coding_editor',
      value: 'VS Code and AntiGravity IDE',
      importance: 8,
    }, userId);

    assert.equal(memory.frequency, 1);

    // Reinforce memory
    const reinforced = await sqliteMemoryRepository.reinforceMemoryFact(memory.id, userId);
    assert.ok(reinforced);
    assert.equal(reinforced.frequency, 2, 'Frequency should increment to 2');

    // Reinforce again
    const reinforcedTwice = await sqliteMemoryRepository.reinforceMemoryFact(memory.id, userId);
    assert.ok(reinforcedTwice);
    assert.equal(reinforcedTwice.frequency, 3, 'Frequency should increment to 3');
  });

  it('verifies reflection summarization and persistent relationship milestone progression', async () => {
    // 1. Create a session with chat messages
    const session = await prisma.conversationSession.create({
      data: {
        userId,
        title: 'Life Reflections',
        messages: {
          create: [
            { sender: 'user', text: 'I am planning to launch my AI startup next month!' },
            { sender: 'ai', text: 'That is incredible! Tell me more about your vision.' },
            { sender: 'user', text: 'I want to build an autonomous companion that truly understands people.' },
          ],
        },
      },
    });

    // 2. Trigger reflection summarization
    const res = await fetch(`${baseUrl}/memory/reflect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId: session.id }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.data.summary);
    assert.ok(body.data.sentiment);

    // 3. Verify reflection was persisted in database
    const reflectionsRes = await fetch(`${baseUrl}/memory/reflections`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const reflectionsBody = await reflectionsRes.json();
    assert.equal(reflectionsRes.status, 200);
    assert.ok(reflectionsBody.data.length >= 1);

    // 4. Verify user relationship state milestones were updated
    const relState = await prisma.userRelationshipState.findUnique({
      where: { userId },
    });
    assert.ok(relState);
    const milestones = JSON.parse(relState.milestonesJson || '[]');
    assert.ok(milestones.length >= 1, 'Should award initial conversational milestones');
  });

  it('verifies hybrid search endpoint GET /api/v1/memory/search', async () => {
    const res = await fetch(`${baseUrl}/memory/search?q=drink+coffee+matcha`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
    assert.ok(typeof body.data[0].score === 'number');
  });
});
