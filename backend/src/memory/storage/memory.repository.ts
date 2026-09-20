/**
 * AURA Memory Engine — Repository Contract (Abstract Storage Interface)
 * Defines pure data access contracts for reading and writing memory data.
 * Keeps storage vector-ready and decoupled from Prisma, SQLite, or future Vector databases.
 */

import {
  MemoryFactEntity,
  CreateMemoryFactDto,
  UpdateMemoryFactDto,
  UserProfileEntity,
  UpdateUserProfileDto,
  ReflectionEntity,
  CreateReflectionDto,
  MemorySearchFilter,
} from '../types/index.js';

export interface IMemoryRepository {
  /**
   * Persists a new MemoryFact entity to storage.
   */
  createMemoryFact(dto: CreateMemoryFactDto, userId?: string): Promise<MemoryFactEntity>;

  /**
   * Updates an existing MemoryFact by ID.
   */
  updateMemoryFact(id: string, dto: UpdateMemoryFactDto, userId?: string): Promise<MemoryFactEntity>;

  /**
   * Deletes a MemoryFact by ID.
   */
  deleteMemoryFact(id: string, userId?: string): Promise<boolean>;

  /**
   * Reinforces a MemoryFact by incrementing usage frequency and bumping lastUsedAt
   */
  reinforceMemoryFact(id: string, userId?: string): Promise<MemoryFactEntity | null>;

  /**
   * Retrieves a MemoryFact by ID.
   */
  getMemoryFactById(id: string, userId?: string): Promise<MemoryFactEntity | null>;

  /**
   * Queries MemoryFacts using search filter criteria (category, keywords, minImportance).
   */
  findRelevantFacts(filter: MemorySearchFilter, userId?: string): Promise<MemoryFactEntity[]>;

  /**
   * Retrieves all MemoryFacts in storage for a given user.
   */
  getAllMemoryFacts(limit?: number, userId?: string): Promise<MemoryFactEntity[]>;

  /**
   * Retrieves the current UserProfile identity record or null if not yet initialized.
   */
  getUserProfile(userId?: string): Promise<UserProfileEntity | null>;

  /**
   * Creates or updates the UserProfile record.
   */
  updateUserProfile(dto: UpdateUserProfileDto, userId?: string): Promise<UserProfileEntity>;

  /**
   * Creates a new Reflection entry.
   */
  createReflection(dto: CreateReflectionDto, userId?: string): Promise<ReflectionEntity>;

  /**
   * Retrieves recent Reflections sorted chronologically.
   */
  getRecentReflections(limit?: number, userId?: string): Promise<ReflectionEntity[]>;
}
