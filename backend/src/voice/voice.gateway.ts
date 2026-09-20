/**
 * AURA Voice Bridge — VoiceGateway (WebSocket Transport)
 * Connects browser WebSocket audio capture stream directly into VoiceManager.
 * Authenticates client WebSocket connections and maps voice sessions to users.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer, IncomingMessage } from 'http';
import { URL } from 'url';
import { voiceManager, VoiceManager } from './voice.manager.js';
import { voiceSessionManager, VoiceSessionManager } from './session/voice.session-manager.js';
import {
  AudioFrameType,
  ClientAudioMessage,
  ServerStateChangedMessage,
  ServerAiAudioChunkMessage,
  ServerErrorMessage,
} from './protocol/audio.protocol.js';
import { VoiceInputStream } from './stream/voice.stream.js';
import { VoiceState } from './types/voice.types.js';
import { verifySupabaseToken } from '../auth/supabase.client.js';
import { logger } from '../utils/logger.js';

interface ActiveSocketState {
  stream: VoiceInputStream;
  sessionId: string;
  userId?: string;
  chunks: Buffer[];
  byteLength: number;
  processing: boolean;
}

export class VoiceGateway {
  private wss?: WebSocketServer;
  private voiceMgr: VoiceManager;
  private sessionMgr: VoiceSessionManager;

  // Track active socket streams
  private socketInputStreams: Map<WebSocket, ActiveSocketState> = new Map();
  private readonly maxTurnBytes = 10 * 1024 * 1024;

  constructor(vMgr: VoiceManager = voiceManager, sMgr: VoiceSessionManager = voiceSessionManager) {
    this.voiceMgr = vMgr;
    this.sessionMgr = sMgr;
  }

  public initialize(server: HttpServer, path: string = '/ws/voice'): WebSocketServer {
    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      // Extract and verify authentication token from query parameters (?token=...)
      let authenticatedUserId: string | undefined;
      try {
        const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const token = parsedUrl.searchParams.get('token');
        if (token) {
          // Verify using the full Supabase→JWT→AURA fallback chain
          const verified = await verifySupabaseToken(token);
          authenticatedUserId = verified.id; // Supabase sub === AURA userId after sync
          logger.info({ userId: authenticatedUserId }, '🎙️ VoiceGateway: Authenticated WebSocket client connected');
        } else {
          // Voice requires authentication — reject unauthenticated connections
          logger.warn('⚠️ VoiceGateway: Rejected unauthenticated WebSocket connection (no token)');
          ws.close(4001, 'Authentication required');
          return;
        }
      } catch (tokenErr) {
        logger.warn({ err: tokenErr }, '⚠️ VoiceGateway: Invalid or expired token — closing connection');
        ws.close(4003, 'Invalid or expired token');
        return;
      }

      ws.on('message', async (data: Buffer | string) => {
        try {
          const msg: ClientAudioMessage = JSON.parse(data.toString());
          await this.handleClientMessage(ws, msg, authenticatedUserId);
        } catch (err: any) {
          logger.error({ err }, '❌ VoiceGateway: Error parsing WS message');
          this.sendErrorMessage(ws, err.message || 'Invalid JSON message');
        }
      });

      ws.on('close', () => {
        logger.info('🎙️ VoiceGateway: WebSocket connection closed');
        this.cleanupSocketStream(ws);
      });

      ws.on('error', (err) => {
        logger.error({ err }, '❌ VoiceGateway: WebSocket error');
        this.cleanupSocketStream(ws);
      });
    });

    logger.info({ path }, '⚡ VoiceGateway WebSocket server initialized');
    return this.wss;
  }

  private async handleClientMessage(ws: WebSocket, msg: ClientAudioMessage, defaultUserId?: string): Promise<void> {
    switch (msg.type) {
      case AudioFrameType.START_SESSION: {
        const sessionInfo = this.sessionMgr.startSession({
          conversationSessionId: msg.conversationSessionId,
        });

        const inputStream = new VoiceInputStream(`ws-in-${sessionInfo.sessionId}`);
        this.socketInputStreams.set(ws, {
          stream: inputStream,
          sessionId: sessionInfo.sessionId,
          userId: defaultUserId,
          chunks: [],
          byteLength: 0,
          processing: false,
        });

        // Listen for Voice State changes to send to client
        const sm = this.sessionMgr.getStateMachine(sessionInfo.sessionId);
        if (sm) {
          sm.on('stateChanged', ({ currentState }: { currentState: VoiceState }) => {
            if (ws.readyState === WebSocket.OPEN) {
              const stateMsg: ServerStateChangedMessage = {
                type: AudioFrameType.STATE_CHANGED,
                sessionId: sessionInfo.sessionId,
                voiceState: currentState,
              };
              ws.send(JSON.stringify(stateMsg));
            }
          });
        }

        // Send SESSION_STARTED to client
        ws.send(
          JSON.stringify({
            type: AudioFrameType.SESSION_STARTED,
            sessionId: sessionInfo.sessionId,
          })
        );
        break;
      }

      case AudioFrameType.AUDIO_CHUNK: {
        const active = this.socketInputStreams.get(ws);
        const chunkMsg = msg as any;
        if (!active || !chunkMsg.audioBase64) {
          return;
        }

        const buffer = Buffer.from(chunkMsg.audioBase64, 'base64');
        if (buffer.length === 0 || active.byteLength + buffer.length > this.maxTurnBytes) {
          this.sendErrorMessage(ws, 'Audio turn is empty or exceeds the 10 MB limit');
          return;
        }
        active.stream.pushChunk(new Uint8Array(buffer));
        active.chunks.push(buffer);
        active.byteLength += buffer.length;
        break;
      }

      case AudioFrameType.TRANSCRIPTION: {
        const active = this.socketInputStreams.get(ws);
        const transcript = msg as any;
        if (!active || !transcript.isFinal || typeof transcript.text !== 'string' || !transcript.text.trim()) return;
        await this.completeTurn(ws, active, transcript.text.trim());
        break;
      }

      case AudioFrameType.END_SPEECH: {
        const active = this.socketInputStreams.get(ws);
        if (!active) return;

        if (active.byteLength === 0) return;
        await this.completeTurn(ws, active);
        break;
      }

      case AudioFrameType.INTERRUPT: {
        const active = this.socketInputStreams.get(ws);
        if (active) {
          this.voiceMgr.handleInterruption(active.sessionId, (msg as any).reason || 'Client WebSocket interrupt');
        }
        break;
      }

      case AudioFrameType.STOP_SESSION: {
        const active = this.socketInputStreams.get(ws);
        if (active) {
          this.sessionMgr.stopSession(active.sessionId);
          this.socketInputStreams.delete(ws);
        }
        break;
      }
    }
  }

  private async completeTurn(ws: WebSocket, active: ActiveSocketState, transcriptionText?: string): Promise<void> {
    if (active.processing) return;
    active.processing = true;
    active.stream.finish();
    try {
      const result = await this.voiceMgr.processVoiceTurn({
        audioChunk: transcriptionText ? undefined : new Uint8Array(Buffer.concat(active.chunks)),
        transcriptionText,
        voiceSessionId: active.sessionId,
        userId: active.userId,
      });
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: AudioFrameType.TRANSCRIPTION, sessionId: active.sessionId, text: result.userTranscription, isFinal: true }));
        ws.send(JSON.stringify({ type: 'AI_RESPONSE_TEXT', sessionId: active.sessionId, conversationSessionId: result.conversationSessionId, text: result.aiResponseText }));
        if (result.aiAudio?.audioChunk) {
          const aiAudioMsg: ServerAiAudioChunkMessage = { type: AudioFrameType.AI_AUDIO_CHUNK, sessionId: active.sessionId, audioBase64: Buffer.from(result.aiAudio.audioChunk).toString('base64'), sampleRate: result.aiAudio.sampleRate };
          ws.send(JSON.stringify(aiAudioMsg));
        }
        ws.send(JSON.stringify({ type: AudioFrameType.AI_AUDIO_END, sessionId: active.sessionId, text: result.aiResponseText }));
      }
    } catch (err: any) {
      logger.error({ err, sessionId: active.sessionId }, 'VoiceGateway: voice turn failed');
      this.sendErrorMessage(ws, err.message || 'Voice turn failed');
    } finally {
      if (this.socketInputStreams.get(ws) === active) {
        this.socketInputStreams.set(ws, {
          stream: new VoiceInputStream(`ws-in-${active.sessionId}`),
          sessionId: active.sessionId,
          userId: active.userId,
          chunks: [],
          byteLength: 0,
          processing: false,
        });
      }
    }
  }

  private sendErrorMessage(ws: WebSocket, message: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      const errPayload: ServerErrorMessage = {
        type: AudioFrameType.ERROR,
        error: message,
      };
      ws.send(JSON.stringify(errPayload));
    }
  }

  private cleanupSocketStream(ws: WebSocket): void {
    const active = this.socketInputStreams.get(ws);
    if (active) {
      active.stream.close();
      this.sessionMgr.stopSession(active.sessionId);
      this.socketInputStreams.delete(ws);
    }
  }

  public async close(): Promise<void> {
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
    }
  }
}
