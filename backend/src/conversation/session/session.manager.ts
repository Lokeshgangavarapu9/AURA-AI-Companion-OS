/**
 * AURA Conversation Intelligence Engine — Session Manager
 * Executes session business logic (session creation, resumption, message appending, thread loading).
 * Strictly decoupled: Contains ZERO LLM calls, ZERO PromptBuilder calls, and ZERO Memory Engine calls.
 * Fully supports multi-tenant user isolation.
 */

import { ISessionRepository } from './session.repository.js';
import { sqliteSessionRepository } from './sqlite.session.js';
import {
  SessionMetadata,
  ChatMessageEntity,
  CreateSessionDto,
  AppendMessageDto,
} from '../types/index.js';
import { logger } from '../../utils/logger.js';

export class SessionManager {
  private repository: ISessionRepository;

  constructor(repository: ISessionRepository = sqliteSessionRepository) {
    this.repository = repository;
  }

  /**
   * Lists all active and saved ConversationSessions, optionally scoped to a user.
   */
  public async listSessions(userId?: string): Promise<SessionMetadata[]> {
    return this.repository.listSessions(userId);
  }

  /**
   * Retrieves session metadata by ID.
   */
  public async getSession(sessionId: string, userId?: string): Promise<SessionMetadata | null> {
    return this.repository.getSessionById(sessionId, userId);
  }

  /**
   * Creates a new ConversationSession record.
   */
  public async createSession(dto?: CreateSessionDto, userId?: string): Promise<SessionMetadata> {
    const session = await this.repository.createSession(dto, userId);
    logger.info({ sessionId: session.id, title: session.title, userId: session.userId }, '✅ SessionManager: Created new session');
    return session;
  }

  /**
   * Resumes an existing ConversationSession by ID.
   * If session does not exist, creates a new one gracefully.
   */
  public async resumeSession(sessionId: string, userId?: string): Promise<SessionMetadata> {
    const existing = await this.repository.getSessionById(sessionId, userId);

    if (existing) {
      // Touch lastInteractionAt timestamp
      const updated = await this.repository.updateSession(sessionId, {
        lastInteractionAt: new Date(),
      }, userId);
      logger.info({ sessionId: updated.id, userId }, '✅ SessionManager: Resumed active session');
      return updated;
    }

    logger.warn({ sessionId, userId }, '⚠️ SessionManager: Requested session not found — creating new session fallback');
    return this.createSession({ title: 'Resumed Conversation' }, userId);
  }

  /**
   * Ends and deletes a ConversationSession.
   */
  public async endSession(sessionId: string, userId?: string): Promise<boolean> {
    const deleted = await this.repository.deleteSession(sessionId, userId);
    if (deleted) {
      logger.info({ sessionId, userId }, '✅ SessionManager: Ended and deleted session');
    } else {
      logger.warn({ sessionId, userId }, '⚠️ SessionManager: Failed to end session — session not found');
    }
    return deleted;
  }

  /**
   * Appends a user or AI message to a session thread and increments message count.
   */
  public async appendMessage(dto: AppendMessageDto): Promise<ChatMessageEntity> {
    const message = await this.repository.appendMessage(dto);
    await this.incrementMessageCount(dto.sessionId);
    return message;
  }

  /**
   * Loads recent chat message thread for a session sorted chronologically.
   */
  public async loadRecentMessages(sessionId: string, limit = 50): Promise<ChatMessageEntity[]> {
    return this.repository.getMessagesBySessionId(sessionId, limit);
  }

  /**
   * Updates metadata on an existing session.
   */
  public async updateSession(sessionId: string, data: Partial<SessionMetadata>, userId?: string): Promise<SessionMetadata> {
    return this.repository.updateSession(sessionId, data, userId);
  }

  /**
   * Increments message count on a session and updates lastInteractionAt timestamp.
   */
  public async incrementMessageCount(sessionId: string): Promise<void> {
    const session = await this.repository.getSessionById(sessionId);
    if (session) {
      const newCount = session.messageCount + 1;
      await this.repository.updateSession(sessionId, {
        messageCount: newCount,
        lastInteractionAt: new Date(),
      });
    }
  }
}

/** Singleton instance export for SessionManager */
export const sessionManager = new SessionManager();
