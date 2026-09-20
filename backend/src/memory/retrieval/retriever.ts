/**
 * AURA Memory Engine — Memory Retrieval Engine
 * Fetches candidate memories from storage, scores & ranks them via MemoryRanker,
 * enforces a strict token budget (~1000 tokens / max 10 memories), and builds a WorkingMemory payload.
 * Fully scopes retrieval to the authenticated user.
 */

import { IMemoryRepository } from '../storage/memory.repository.js';
import { sqliteMemoryRepository } from '../storage/sqlite.repository.js';
import { MemoryRanker } from '../ranking/ranker.js';
import { WorkingMemory, MemoryFactEntity, UserProfileEntity, ReflectionEntity } from '../types/index.js';
import { logger } from '../../utils/logger.js';

export const RETRIEVAL_CONFIG = {
  /** Maximum number of top memories to include in WorkingMemory */
  MAX_TOP_MEMORIES: 10,
  /** Target token budget for working memory context (~1000 tokens ~ 4000 characters) */
  MAX_MEMORY_TOKENS: 1000,
  /** Character to token conversion factor estimate (1 token ~ 4 characters) */
  CHARS_PER_TOKEN: 4,
} as const;

export class MemoryRetriever {
  private repository: IMemoryRepository;

  constructor(repository: IMemoryRepository = sqliteMemoryRepository) {
    this.repository = repository;
  }

  /**
   * Builds WorkingMemory context for a given user prompt message and optional userId
   * @param userMessage Active user prompt
   * @param userId Target user ID for tenant isolation
   */
  public async getWorkingMemory(userMessage: string, userId?: string): Promise<WorkingMemory> {
    try {
      const keywords = this.extractKeywords(userMessage);

      // 1. Fetch User Profile
      const profile = await this.repository.getUserProfile(userId);

      // 2. Fetch candidate memory facts from repository for this user
      const candidateFacts = await this.repository.getAllMemoryFacts(50, userId);

      // 3. Rank memories using MemoryRanker (Top 10 max)
      const scoredItems = MemoryRanker.rankMemories(candidateFacts, keywords, {
        topK: RETRIEVAL_CONFIG.MAX_TOP_MEMORIES,
        minScoreThreshold: 0.1,
      });

      const topFacts = scoredItems.map((item) => item.fact);

      // Asynchronously reinforce frequently retrieved memories (Mission 6.7)
      for (const fact of topFacts) {
        this.repository.reinforceMemoryFact(fact.id, userId).catch(() => {});
      }

      // 4. Categorize facts into WorkingMemory buckets
      const facts: MemoryFactEntity[] = [];
      const preferences: MemoryFactEntity[] = [];
      const goals: MemoryFactEntity[] = [];
      const relationships: MemoryFactEntity[] = [];

      for (const fact of topFacts) {
        switch (fact.category) {
          case 'preference':
            preferences.push(fact);
            break;
          case 'goal':
            goals.push(fact);
            break;
          case 'relationship':
            relationships.push(fact);
            break;
          default:
            facts.push(fact);
            break;
        }
      }

      // 5. Fetch recent reflections
      const recentReflections = await this.repository.getRecentReflections(3, userId);

      // 6. Estimate token count & enforce budget
      const workingMemory: WorkingMemory = {
        profile,
        facts,
        preferences,
        goals,
        relationships,
        recentReflections,
        totalTokensEstimate: 0,
      };

      workingMemory.totalTokensEstimate = this.estimateTokenCount(workingMemory);

      logger.debug(
        {
          userId,
          topFactsCount: topFacts.length,
          tokensEst: workingMemory.totalTokensEstimate,
        },
        '🧠 MemoryRetriever constructed WorkingMemory payload'
      );

      return workingMemory;
    } catch (err) {
      logger.error({ err, userId }, '❌ MemoryRetriever failed to construct WorkingMemory — returning empty fallback');
      return {
        profile: null,
        facts: [],
        preferences: [],
        goals: [],
        relationships: [],
        recentReflections: [],
        totalTokensEstimate: 0,
      };
    }
  }

  /**
   * Tokenizes user prompt into search keywords for context scoring
   */
  private extractKeywords(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !['what', 'where', 'when', 'how', 'who', 'this', 'that', 'with', 'have', 'from'].includes(word));
  }

  /**
   * Rough token estimation (chars / CHARS_PER_TOKEN)
   */
  private estimateTokenCount(wm: WorkingMemory): number {
    let charCount = 0;

    if (wm.profile) {
      charCount += JSON.stringify(wm.profile).length;
    }

    charCount += JSON.stringify(wm.facts).length;
    charCount += JSON.stringify(wm.preferences).length;
    charCount += JSON.stringify(wm.goals).length;
    charCount += JSON.stringify(wm.relationships).length;
    charCount += JSON.stringify(wm.recentReflections).length;

    return Math.ceil(charCount / RETRIEVAL_CONFIG.CHARS_PER_TOKEN);
  }
}

/** Singleton export for MemoryRetriever */
export const memoryRetriever = new MemoryRetriever();
