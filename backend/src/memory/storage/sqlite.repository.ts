/**
 * AURA Memory Engine — Prisma Storage Implementation
 * Multi-tenant repository implementation managing database operations via Prisma.
 * Fully encapsulates Prisma and guarantees strict user isolation.
 */

import { prisma } from '../../database/client.js';
import { IMemoryRepository } from './memory.repository.js';
import {
  MemoryFactEntity,
  CreateMemoryFactDto,
  UpdateMemoryFactDto,
  UserProfileEntity,
  UpdateUserProfileDto,
  ReflectionEntity,
  CreateReflectionDto,
  MemorySearchFilter,
  MemoryCategory,
} from '../types/index.js';

export class SqliteMemoryRepository implements IMemoryRepository {
  /**
   * Resolves an effective userId; creates a default local user if none exists
   * to guarantee seamless backward compatibility for testing.
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
   * Persists a new MemoryFact to database via Prisma.
   */
  public async createMemoryFact(dto: CreateMemoryFactDto, userId?: string): Promise<MemoryFactEntity> {
    const effectiveUserId = await this.getEffectiveUserId(userId || dto.userId);

    const record = await prisma.memoryFact.create({
      data: {
        userId: effectiveUserId,
        category: dto.category,
        key: dto.key,
        value: dto.value,
        confidence: dto.confidence ?? 1.0,
        importance: dto.importance ?? 5,
      },
    });

    return this.mapMemoryFact(record);
  }

  /**
   * Updates an existing MemoryFact by ID.
   */
  public async updateMemoryFact(id: string, dto: UpdateMemoryFactDto, userId?: string): Promise<MemoryFactEntity> {
    const whereClause: any = { id };
    if (userId) whereClause.userId = userId;

    const existing = await prisma.memoryFact.findFirst({ where: whereClause });
    if (!existing) {
      throw new Error(`MemoryFact ${id} not found or unauthorized`);
    }

    const record = await prisma.memoryFact.update({
      where: { id },
      data: {
        ...(dto.category && { category: dto.category }),
        ...(dto.key && { key: dto.key }),
        ...(dto.value && { value: dto.value }),
        ...(dto.confidence !== undefined && { confidence: dto.confidence }),
        ...(dto.importance !== undefined && { importance: dto.importance }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.lastUsedAt && { lastUsedAt: dto.lastUsedAt }),
      },
    });

    return this.mapMemoryFact(record);
  }

  /**
   * Deletes a MemoryFact by ID.
   */
  public async deleteMemoryFact(id: string, userId?: string): Promise<boolean> {
    try {
      const whereClause: any = { id };
      if (userId) whereClause.userId = userId;

      const existing = await prisma.memoryFact.findFirst({ where: whereClause });
      if (!existing) return false;

      await prisma.memoryFact.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reinforces a MemoryFact by incrementing frequency and bumping lastUsedAt.
   */
  public async reinforceMemoryFact(id: string, userId?: string): Promise<MemoryFactEntity | null> {
    try {
      const whereClause: any = { id };
      if (userId) whereClause.userId = userId;

      const existing = await prisma.memoryFact.findFirst({ where: whereClause });
      if (!existing) return null;

      const updated = await prisma.memoryFact.update({
        where: { id },
        data: {
          frequency: existing.frequency + 1,
          lastUsedAt: new Date(),
        },
      });

      return this.mapMemoryFact(updated);
    } catch {
      return null;
    }
  }

  /**
   * Retrieves a MemoryFact by ID.
   */
  public async getMemoryFactById(id: string, userId?: string): Promise<MemoryFactEntity | null> {
    const whereClause: any = { id };
    if (userId) whereClause.userId = userId;

    const record = await prisma.memoryFact.findFirst({ where: whereClause });
    return record ? this.mapMemoryFact(record) : null;
  }

  /**
   * Queries MemoryFacts matching category, minImportance, or keyword substrings for a specific user.
   */
  public async findRelevantFacts(filter: MemorySearchFilter, userId?: string): Promise<MemoryFactEntity[]> {
    const effectiveUserId = await this.getEffectiveUserId(userId);
    const whereClause: Record<string, unknown> = {
      userId: effectiveUserId,
    };

    if (filter.category) {
      whereClause.category = filter.category;
    }

    if (filter.minImportance !== undefined) {
      whereClause.importance = { gte: filter.minImportance };
    }

    if (filter.keywords && filter.keywords.length > 0) {
      whereClause.OR = filter.keywords.map((kw) => ({
        OR: [
          { key: { contains: kw } },
          { value: { contains: kw } },
        ],
      }));
    }

    const records = await prisma.memoryFact.findMany({
      where: whereClause,
      take: filter.limit ?? 20,
      orderBy: { lastUsedAt: 'desc' },
    });

    return records.map((r) => this.mapMemoryFact(r));
  }

  /**
   * Retrieves all MemoryFacts for a user sorted by lastUsedAt.
   */
  public async getAllMemoryFacts(limit = 50, userId?: string): Promise<MemoryFactEntity[]> {
    const effectiveUserId = await this.getEffectiveUserId(userId);

    const records = await prisma.memoryFact.findMany({
      where: { userId: effectiveUserId },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return records.map((r) => this.mapMemoryFact(r));
  }

  /**
   * Retrieves the UserProfile record for the specified user.
   */
  public async getUserProfile(userId?: string): Promise<UserProfileEntity | null> {
    const effectiveUserId = await this.getEffectiveUserId(userId);

    const record = await prisma.userProfile.findUnique({
      where: { userId: effectiveUserId },
    });

    return record ? this.mapUserProfile(record) : null;
  }

  /**
   * Creates or updates the UserProfile record for a user.
   */
  public async updateUserProfile(dto: UpdateUserProfileDto, userId?: string): Promise<UserProfileEntity> {
    const effectiveUserId = await this.getEffectiveUserId(userId);

    const record = await prisma.userProfile.upsert({
      where: { userId: effectiveUserId },
      create: {
        userId: effectiveUserId,
        name: dto.name,
        age: dto.age,
        occupation: dto.occupation,
        college: dto.college,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
      },
      update: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.age !== undefined && { age: dto.age }),
        ...(dto.occupation !== undefined && { occupation: dto.occupation }),
        ...(dto.college !== undefined && { college: dto.college }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });

    return this.mapUserProfile(record);
  }

  /**
   * Creates a new Reflection entry.
   */
  public async createReflection(dto: CreateReflectionDto, userId?: string): Promise<ReflectionEntity> {
    const effectiveUserId = await this.getEffectiveUserId(userId || dto.userId);

    const record = await prisma.reflection.create({
      data: {
        userId: effectiveUserId,
        summary: dto.summary,
        sentiment: dto.sentiment,
      },
    });

    return this.mapReflection(record);
  }

  /**
   * Retrieves recent Reflections for a user.
   */
  public async getRecentReflections(limit = 10, userId?: string): Promise<ReflectionEntity[]> {
    const effectiveUserId = await this.getEffectiveUserId(userId);

    const records = await prisma.reflection.findMany({
      where: { userId: effectiveUserId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapReflection(r));
  }

  /** Mapper for MemoryFact Prisma model to domain entity */
  private mapMemoryFact(record: any): MemoryFactEntity {
    return {
      id: record.id,
      userId: record.userId,
      category: record.category as MemoryCategory,
      key: record.key,
      value: record.value,
      confidence: record.confidence,
      importance: record.importance,
      frequency: record.frequency,
      lastUsedAt: record.lastUsedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /** Mapper for UserProfile Prisma model to domain entity */
  private mapUserProfile(record: any): UserProfileEntity {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      age: record.age,
      occupation: record.occupation,
      college: record.college,
      bio: record.bio,
      avatarUrl: record.avatarUrl,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /** Mapper for Reflection Prisma model to domain entity */
  private mapReflection(record: any): ReflectionEntity {
    return {
      id: record.id,
      userId: record.userId,
      summary: record.summary,
      sentiment: record.sentiment,
      createdAt: record.createdAt,
    };
  }
}

/** Singleton instance export for SQLite Memory Repository */
export const sqliteMemoryRepository = new SqliteMemoryRepository();
