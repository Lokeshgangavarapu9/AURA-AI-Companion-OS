/**
 * AURA Conversation Intelligence Engine — Session Repository Contract
 * Interface defining pure database CRUD operations for ConversationSession and ChatMessageRecord.
 * Completely decoupled from business logic, Gemini, and Prisma.
 */

import {
  SessionMetadata,
  ChatMessageEntity,
  CreateSessionDto,
  AppendMessageDto,
} from '../types/index.js';

export interface ISessionRepository {
  /**
   * Persists a new ConversationSession record.
   */
  createSession(dto?: CreateSessionDto, userId?: string): Promise<SessionMetadata>;

  /**
   * Retrieves all ConversationSession records sorted by pinned status & last interaction.
   * Scoped to userId if provided.
   */
  listSessions(userId?: string): Promise<SessionMetadata[]>;

  /**
   * Retrieves a ConversationSession by ID.
   * Optionally checks userId ownership.
   */
  getSessionById(sessionId: string, userId?: string): Promise<SessionMetadata | null>;

  /**
   * Updates metadata on an existing ConversationSession.
   */
  updateSession(sessionId: string, data: Partial<SessionMetadata>, userId?: string): Promise<SessionMetadata>;

  /**
   * Deletes a ConversationSession and all associated messages.
   */
  deleteSession(sessionId: string, userId?: string): Promise<boolean>;

  /**
   * Appends a new ChatMessageRecord to a session thread.
   */
  appendMessage(dto: AppendMessageDto): Promise<ChatMessageEntity>;

  /**
   * Retrieves recent ChatMessageRecords for a session thread.
   */
  getMessagesBySessionId(sessionId: string, limit?: number): Promise<ChatMessageEntity[]>;

  /**
   * Gets the total message count for a session.
   */
  getMessageCount(sessionId: string): Promise<number>;
}
