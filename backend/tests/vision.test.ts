import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { app } from '../src/app.js';
import { prisma, connectDatabase, disconnectDatabase } from '../src/database/client.js';

describe('Mission 6.5 — Multimodal Vision Intelligence Test Suite', () => {
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

  const sampleBase64 = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-image-bytes').toString('base64');

  it('POST /api/v1/vision/analyze returns 400 when imageBase64 is missing', async () => {
    const res = await fetch(`${baseUrl}/vision/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'What is this?' }),
    });

    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.status, 'error');
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('POST /api/v1/vision/analyze succeeds and returns visual analysis result', async () => {
    const res = await fetch(`${baseUrl}/vision/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Describe what is in this scene.',
        imageBase64: sampleBase64,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
    assert.ok(typeof body.data.text === 'string');
    assert.ok(body.data.text.length > 0);
    assert.ok(typeof body.data.sessionId === 'string');
    assert.ok(typeof body.data.timestamp === 'string');

    // Verify session was persisted in database
    const session = await prisma.conversationSession.findUnique({
      where: { id: body.data.sessionId },
      include: { messages: true },
    });

    assert.ok(session, 'Vision session must be persisted in database');
    assert.ok(session.messages.length >= 2, 'Must persist user visual prompt and AI perception response');
  });

  it('POST /api/v1/vision/analyze appends to existing conversation session', async () => {
    // 1. Create a session first
    const initRes = await fetch(`${baseUrl}/vision/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'First vision frame',
        imageBase64: sampleBase64,
      }),
    });

    const initBody = await initRes.json();
    const sessionId = initBody.data.sessionId;

    // 2. Send subsequent vision frame using same sessionId
    const followRes = await fetch(`${baseUrl}/vision/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        prompt: 'Follow-up question about this scene',
        imageBase64: sampleBase64,
      }),
    });

    const followBody = await followRes.json();
    assert.equal(followRes.status, 200);
    assert.equal(followBody.data.sessionId, sessionId);

    // Verify session message count grew
    const updated = await prisma.conversationSession.findUnique({
      where: { id: sessionId },
      include: { messages: true },
    });

    assert.equal(updated?.messages.length, 4, 'Should contain 4 messages (2 user + 2 AI)');
  });
});
