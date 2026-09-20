/**
 * AURA Memory Engine — Memory Scoring Engine
 * Computes deterministic multi-factor relevance scores for memory entities.
 * Fully decoupled from storage, databases, and LLM calls.
 */

import { MemoryFactEntity } from '../types/index.js';

/** Detailed breakdown of all calculated scoring factors for a memory fact */
export interface MemoryScore {
  memoryId: string;
  importanceScore: number;
  recencyScore: number;
  frequencyScore: number;
  emotionalScore: number;
  relationshipScore: number;
  contextScore: number;
  isPinned: boolean;
  finalScore: number;
}

/** Configuration parameters and weight coefficients for memory scoring */
export const SCORING_CONFIG = {
  /** Weight coefficient for normalized importance (0.0 to 1.0) */
  WEIGHT_IMPORTANCE: 0.25,
  /** Weight coefficient for exponential recency decay (0.0 to 1.0) */
  WEIGHT_RECENCY: 0.25,
  /** Weight coefficient for usage frequency (0.0 to 1.0) */
  WEIGHT_FREQUENCY: 0.15,
  /** Weight coefficient for emotional significance (0.0 to 1.0) */
  WEIGHT_EMOTION: 0.15,
  /** Weight coefficient for relationship category relevance (0.0 to 1.0) */
  WEIGHT_RELATIONSHIP: 0.10,
  /** Weight coefficient for query context keyword match (0.0 to 1.0) */
  WEIGHT_CONTEXT: 0.10,

  /** Half-life for recency decay in days (e.g. 7 days) */
  RECENCY_HALF_LIFE_DAYS: 7,

  /** Multiplier score boost applied if memory is explicitly pinned */
  PINNED_BOOST: 1.5,
} as const;

export class MemoryScorer {
  /**
   * Computes comprehensive MemoryScore for a single MemoryFactEntity
   * @param fact The MemoryFactEntity to evaluate
   * @param queryKeywords Optional list of tokenized keywords from the user prompt
   * @param referenceTime Optional reference timestamp for recency calculation (defaults to Date.now())
   * @param emotionalWeight Optional W_e factor (0.5 <= W_e <= 2.0) provided by Emotion Engine WeightCalculator
   * @param relationshipWeight Optional W_rel factor (0.8 <= W_rel <= 1.3) provided by Relationship Engine
   */
  public static scoreMemory(
    fact: MemoryFactEntity,
    queryKeywords: string[] = [],
    referenceTime: Date = new Date(),
    emotionalWeight?: number,
    relationshipWeight?: number
  ): MemoryScore {
    const importanceScore = this.calculateImportanceScore(fact.importance);
    const recencyScore = this.calculateRecencyScore(fact.lastUsedAt || fact.createdAt, referenceTime);
    const frequencyScore = this.calculateFrequencyScore(fact.frequency);
    const emotionalScore = this.calculateEmotionalScore(fact.category, fact.importance);
    const relationshipScore = this.calculateRelationshipScore(fact.category);
    const contextScore = this.calculateContextScore(fact, queryKeywords);
    const isPinned = (fact as any).isPinned === true;

    // Base deterministic weighted sum before relationship-aware signal scaling.
    const baseScore =
      importanceScore * SCORING_CONFIG.WEIGHT_IMPORTANCE +
      recencyScore * SCORING_CONFIG.WEIGHT_RECENCY +
      frequencyScore * SCORING_CONFIG.WEIGHT_FREQUENCY +
      emotionalScore * SCORING_CONFIG.WEIGHT_EMOTION +
      relationshipScore * SCORING_CONFIG.WEIGHT_RELATIONSHIP +
      contextScore * SCORING_CONFIG.WEIGHT_CONTEXT;

    const safeEmotionalWeight = emotionalWeight !== undefined && emotionalWeight > 0 ? emotionalWeight : 1.0;
    const safeRelationshipWeight = relationshipWeight !== undefined && relationshipWeight > 0 ? relationshipWeight : 1.0;
    const affinity = this.calculateMemoryEmotionAffinity(fact, queryKeywords);

    // Phase 4.1 + 4.2 Integration: FinalScore = BaseScore × W_e × MemoryEmotionAffinity × W_rel
    let finalScore = baseScore * safeEmotionalWeight * affinity * safeRelationshipWeight;

    // Apply pinned boost if applicable
    if (isPinned) {
      finalScore *= SCORING_CONFIG.PINNED_BOOST;
    }

    return {
      memoryId: fact.id,
      importanceScore: Math.round(importanceScore * 100) / 100,
      recencyScore: Math.round(recencyScore * 100) / 100,
      frequencyScore: Math.round(frequencyScore * 100) / 100,
      emotionalScore: Math.round(emotionalScore * 100) / 100,
      relationshipScore: Math.round(relationshipScore * 100) / 100,
      contextScore: Math.round(contextScore * 100) / 100,
      isPinned,
      finalScore: Math.round(finalScore * 1000) / 1000,
    };
  }

  /**
   * Calculates MemoryEmotionAffinity (0.1 to 1.0) based on category, keyword match, and goal relevance.
   */
  public static calculateMemoryEmotionAffinity(
    fact: MemoryFactEntity,
    queryKeywords: string[] = []
  ): number {
    let baseAffinity = 0.2;

    // 1. Category-based base affinity
    if (fact.category === 'goal') {
      baseAffinity = 0.6;
    } else if (fact.category === 'preference') {
      baseAffinity = 0.4;
    } else if (fact.category === 'relationship') {
      baseAffinity = 0.3;
    }

    // 2. Keyword/Content relevance matching
    const contentText = `${fact.key} ${fact.value} ${(fact as any).tags?.join(' ') || ''}`.toLowerCase();
    let keywordBoost = 0;

    if (queryKeywords && queryKeywords.length > 0) {
      for (const kw of queryKeywords) {
        if (contentText.includes(kw.toLowerCase())) {
          keywordBoost += 0.4;
        }
      }
    }

    // 3. Emotional high-salience terms (e.g. exam, test, stress, career, health, goal, fear, worry)
    const salienceTerms = ['exam', 'test', 'study', 'stress', 'career', 'job', 'fear', 'worry', 'health', 'deadline', 'goal'];
    for (const term of salienceTerms) {
      if (contentText.includes(term)) {
        keywordBoost += 0.3;
        break;
      }
    }

    const totalAffinity = Math.min(1.0, Math.max(0.1, baseAffinity + keywordBoost));
    return Math.round(totalAffinity * 100) / 100;
  }

  /**
   * Normalizes importance (1 to 10 scale -> 0.0 to 1.0)
   */
  private static calculateImportanceScore(importance: number): number {
    const clamped = Math.max(1, Math.min(10, importance));
    return clamped / 10.0;
  }

  /**
   * Calculates exponential decay recency score R = e^(-lambda * days)
   */
  private static calculateRecencyScore(lastUsedAt: Date, referenceTime: Date): number {
    const diffMs = referenceTime.getTime() - new Date(lastUsedAt).getTime();
    const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
    const lambda = Math.LN2 / SCORING_CONFIG.RECENCY_HALF_LIFE_DAYS;
    return Math.exp(-lambda * diffDays);
  }

  /**
   * Calculates logarithmic frequency score (F >= 1)
   */
  private static calculateFrequencyScore(frequency: number): number {
    const count = Math.max(1, frequency);
    return Math.min(1.0, Math.log2(count + 1) / 5.0);
  }

  /**
   * Estimates emotional weight based on category and high importance
   */
  private static calculateEmotionalScore(category: string, importance: number): number {
    if (category === 'preference' || category === 'goal') {
      return Math.min(1.0, (importance / 10.0) * 1.2);
    }
    return Math.min(1.0, importance / 10.0);
  }

  /**
   * Gives higher structural weight to relationship memories
   */
  private static calculateRelationshipScore(category: string): number {
    return category === 'relationship' ? 1.0 : 0.4;
  }

  /**
   * Computes hybrid keyword + semantic context score between query keywords and memory key/value
   */
  private static calculateContextScore(fact: MemoryFactEntity, queryKeywords: string[]): number {
    if (!queryKeywords || queryKeywords.length === 0) return 0.5; // neutral baseline when no query provided

    const textToMatch = `${fact.key} ${fact.value} ${fact.category}`.toLowerCase();
    let keywordMatches = 0;

    // 1. Direct Keyword Matching
    for (const kw of queryKeywords) {
      if (textToMatch.includes(kw.toLowerCase())) {
        keywordMatches++;
      }
    }
    const keywordScore = Math.min(1.0, keywordMatches / Math.max(1, queryKeywords.length));

    // 2. Semantic Conceptual Relevance
    let semanticBoost = 0.0;
    const queryJoined = queryKeywords.join(' ').toLowerCase();

    // Preference intent detection
    if (fact.category === 'preference' && (queryJoined.includes('like') || queryJoined.includes('love') || queryJoined.includes('prefer') || queryJoined.includes('favorite') || queryJoined.includes('hate'))) {
      semanticBoost += 0.35;
    }

    // Goal & aspiration intent detection
    if (fact.category === 'goal' && (queryJoined.includes('plan') || queryJoined.includes('want') || queryJoined.includes('goal') || queryJoined.includes('achieve') || queryJoined.includes('future') || queryJoined.includes('hope'))) {
      semanticBoost += 0.35;
    }

    // Relationship intent detection
    if (fact.category === 'relationship' && (queryJoined.includes('who') || queryJoined.includes('friend') || queryJoined.includes('partner') || queryJoined.includes('family') || queryJoined.includes('boss') || queryJoined.includes('brother') || queryJoined.includes('sister'))) {
      semanticBoost += 0.35;
    }

    // N-gram / character level fuzzy overlap for non-exact spelling
    let charOverlap = 0;
    for (const kw of queryKeywords) {
      if (kw.length >= 4) {
        const trigrams = [kw.slice(0, 3), kw.slice(1, 4), kw.slice(-3)];
        if (trigrams.some((tri) => textToMatch.includes(tri))) {
          charOverlap += 0.15;
        }
      }
    }
    const semanticScore = Math.min(1.0, semanticBoost + Math.min(0.4, charOverlap));

    // 3. Hybrid Combination (50% lexical keyword + 50% semantic context)
    const hybridScore = 0.55 * keywordScore + 0.45 * semanticScore;
    return Math.min(1.0, Math.round(hybridScore * 100) / 100);
  }
}
