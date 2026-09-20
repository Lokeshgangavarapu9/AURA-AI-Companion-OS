/**
 * AURA Conversation Intelligence Engine — Prisma Session Repository
 * Multi-tenant concrete implementation managing database queries via Prisma.
 * Encapsulates Prisma entirely and enforces user-isolated session records.
 */

import { prisma } from '../../database/client.js';
import { ISessionRepository } from './session.repository.js';
import {
  SessionMetadata,
  ChatMessageEntity,
  CreateSessionDto,
  AppendMessageDto,
  ChatMessageSender,
} from '../types/index.js';

export class SqliteSessionRepository implements ISessionRepository {
  /**
   * Resolves an effective userId; creates a default local user if none exists
   * to guarantee seamless backward compatibility.
   */
  public async getEffectiveUserId(userId?: string): Promise<string> {
    if (userId) return userId;

    const existingUser = await prisma.user.findFirst();
    if (existingUser) return existingUser.id;

    const defaultUser = await prisma.user.create({
      data: {
        email: 'user@aura.os',
        name: 'Alex',
        provider: 'local',
      },
    });

    return defaultUser.id;
  }

  /**
   * Creates a new ConversationSession record in the database.
   */
  public async createSession(dto?: CreateSessionDto, userId?: string): Promise<SessionMetadata> {
    const effectiveUserId = await this.getEffectiveUserId(userId || dto?.userId);

    const record = await prisma.conversationSession.create({
      data: {
        userId: effectiveUserId,
        title: dto?.title ?? 'New Conversation',
        currentTopic: dto?.initialTopic ?? 'General',
        messageCount: 0,
        isPinned: false,
      },
    });

    return this.mapSession(record);
  }

  /**
   * Retrieves all ConversationSessions sorted by pinned status (desc) and last interaction (desc).
   * Scoped to userId if provided.
   */
  public async listSessions(userId?: string): Promise<SessionMetadata[]> {
    const whereClause: any = {};
    if (userId) {
      whereClause.userId = userId;
    }

    const records = await prisma.conversationSession.findMany({
      where: whereClause,
      orderBy: [
        { isPinned: 'desc' },
        { lastInteractionAt: 'desc' },
      ],
    });

    return records.map((r) => this.mapSession(r));
  }

  /**
   * Retrieves a ConversationSession by ID, optionally verifying userId ownership.
   */
  public async getSessionById(sessionId: string, userId?: string): Promise<SessionMetadata | null> {
    const whereClause: any = { id: sessionId };
    if (userId) {
      whereClause.userId = userId;
    }

    const record = await prisma.conversationSession.findFirst({
      where: whereClause,
    });

    return record ? this.mapSession(record) : null;
  }

  /**
   * Updates metadata on an existing ConversationSession.
   */
  public async updateSession(sessionId: string, data: Partial<SessionMetadata>, userId?: string): Promise<SessionMetadata> {
    const whereClause: any = { id: sessionId };
    if (userId) {
      whereClause.userId = userId;
    }

    // Verify session exists and belongs to user
    const existing = await prisma.conversationSession.findFirst({ where: whereClause });
    if (!existing) {
      throw new Error(`ConversationSession ${sessionId} not found`);
    }

    const record = await prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.currentTopic !== undefined && { currentTopic: data.currentTopic }),
        ...(data.messageCount !== undefined && { messageCount: data.messageCount }),
        ...(data.isPinned !== undefined && { isPinned: data.isPinned }),
        ...(data.lastInteractionAt && { lastInteractionAt: data.lastInteractionAt }),
      },
    });

    return this.mapSession(record);
  }

  /**
   * Deletes a ConversationSession by ID.
   */
  public async deleteSession(sessionId: string, userId?: string): Promise<boolean> {
    try {
      const whereClause: any = { id: sessionId };
      if (userId) {
        whereClause.userId = userId;
      }

      const existing = await prisma.conversationSession.findFirst({ where: whereClause });
      if (!existing) return false;

      await prisma.conversationSession.delete({ where: { id: sessionId } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Appends a new ChatMessageRecord to database.
   */
  public async appendMessage(dto: AppendMessageDto): Promise<ChatMessageEntity> {
    const record = await prisma.chatMessageRecord.create({
      data: {
        sessionId: dto.sessionId,
        sender: dto.sender,
        text: dto.text,
        emotion: dto.emotion ?? 'neutral',
        topic: dto.topic ?? 'General',
      },
    });

    return this.mapMessage(record);
  }

  /**
   * Retrieves recent ChatMessageRecords for a session thread sorted chronologically.
   */
  public async getMessagesBySessionId(sessionId: string, limit = 50): Promise<ChatMessageEntity[]> {
    const records = await prisma.chatMessageRecord.findMany({
      where: { sessionId },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    return records.map((r) => this.mapMessage(r));
  }

  /**
   * Gets total message count for a session.
   */
  public async getMessageCount(sessionId: string): Promise<number> {
    return prisma.chatMessageRecord.count({
      where: { sessionId },
    });
  }

  /** Mapper for ConversationSession Prisma model to domain entity */
  private mapSession(record: any): SessionMetadata {
    return {
      id: record.id,
      userId: record.userId,
      title: record.title,
      currentTopic: record.currentTopic,
      messageCount: record.messageCount,
      isPinned: record.isPinned ?? false,
      lastInteractionAt: record.lastInteractionAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /** Mapper for ChatMessageRecord Prisma model to domain entity */
  private mapMessage(record: any): ChatMessageEntity {
    return {
      id: record.id,
      sessionId: record.sessionId,
      sender: record.sender as ChatMessageSender,
      text: record.text,
      emotion: record.emotion,
      topic: record.topic,
      createdAt: record.createdAt,
    };
  }
}

/** Singleton instance export for SqliteSessionRepository */
export const sqliteSessionRepository = new SqliteSessionRepository();
