/**
 * AURA Memory Engine — Domain Types & Interfaces
 * Centralized TypeScript type definitions for memory entities, filters, and repository DTOs.
 */

/** Category classification for stored memory facts */
export type MemoryCategory = 'fact' | 'preference' | 'goal' | 'relationship' | 'knowledge';

/** Domain entity representing a stored memory fact */
export interface MemoryFactEntity {
  id: string;
  userId?: string;
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
  importance: number;
  frequency: number;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Data Transfer Object for creating a new MemoryFact */
export interface CreateMemoryFactDto {
  userId?: string;
  category: MemoryCategory;
  key: string;
  value: string;
  confidence?: number;
  importance?: number;
}

/** Data Transfer Object for updating an existing MemoryFact */
export interface UpdateMemoryFactDto {
  category?: MemoryCategory;
  key?: string;
  value?: string;
  confidence?: number;
  importance?: number;
  frequency?: number;
  lastUsedAt?: Date;
}

/** Domain entity representing the User Profile identity */
export interface UserProfileEntity {
  id: string;
  userId?: string;
  name: string | null;
  age: number | null;
  occupation: string | null;
  college: string | null;
  bio: string | null;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Data Transfer Object for updating UserProfile */
export interface UpdateUserProfileDto {
  name?: string;
  age?: number;
  occupation?: string;
  college?: string;
  bio?: string;
  avatarUrl?: string;
}

/** Domain entity representing a meta-reflection or emotional summary */
export interface ReflectionEntity {
  id: string;
  userId?: string;
  summary: string;
  sentiment: string | null;
  createdAt: Date;
}

/** Data Transfer Object for creating a Reflection */
export interface CreateReflectionDto {
  userId?: string;
  summary: string;
  sentiment?: string;
}

/** Filter criteria for searching and querying memories */
export interface MemorySearchFilter {
  category?: MemoryCategory;
  keywords?: string[];
  minImportance?: number;
  limit?: number;
}

/** Formatted Working Memory payload passed into PromptBuilder */
export interface WorkingMemory {
  profile: UserProfileEntity | null;
  facts: MemoryFactEntity[];
  preferences: MemoryFactEntity[];
  goals: MemoryFactEntity[];
  relationships: MemoryFactEntity[];
  recentReflections: ReflectionEntity[];
  totalTokensEstimate: number;
}
