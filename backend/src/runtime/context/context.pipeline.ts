/**
 * AURA Core Runtime Layer — Context Assembly Pipeline
 * Assembles multi-domain context into a single immutable RuntimeContext object
 * while enforcing dynamic P0–P8 token budgeting floating.
 * Scoped per authenticated user.
 */

import {
  RuntimeContext,
  RuntimeOrchestratorInput,
} from '../types/runtime.types.js';
import { memoryEngine } from '../../memory/engine/memory.engine.js';
import { emotionAnalyzer } from '../../emotion/index.js';
import { relationshipAnalyzer } from '../../relationship/index.js';
import { relationshipRepository } from '../../relationship/storage/relationship.repository.js';
import { sqliteMemoryRepository } from '../../memory/storage/sqlite.repository.js';
import { providerManager } from '../../ai/providers/index.js';
import { prisma } from '../../database/client.js';
import { logger } from '../../utils/logger.js';

export const CONTEXT_BUDGET_CONFIG = {
  TOTAL_CEILING_TOKENS: 4000,
  CHARS_PER_TOKEN: 4,
};

export class ContextAssemblyPipeline {
  /**
   * Assembles all domain states into an aggregated immutable RuntimeContext.
   */
  public async assembleContext(
    input: RuntimeOrchestratorInput,
    sessionId: string
  ): Promise<RuntimeContext> {
    const startTime = Date.now();
    const userId = input.userId;

    // 1. Gather Emotion Context
    const emotionalContext =
      input.emotionalContext || emotionAnalyzer.analyze(input.userMessage);

    // 2. Gather Relationship Context from persistent storage
    let relationshipContext = input.relationshipContext;
    if (!relationshipContext) {
      const targetUserId = userId || sessionId;
      const currentRelState = await relationshipRepository.getRelationshipState(targetUserId);
      const relResult = relationshipAnalyzer.analyze({
        userId: targetUserId,
        userMessage: input.userMessage,
        currentState: currentRelState,
        emotionalContext,
      });
      relationshipContext = relResult.context;
      // Asynchronously persist updated relationship state
      relationshipRepository.saveRelationshipState(targetUserId, relResult.updatedState);
    }

    // 3. Gather Working Memory for this user
    const workingMemory = await memoryEngine.getWorkingMemory(input.userMessage, userId);

    // 4. Gather Profile for this user
    const userProfile = await sqliteMemoryRepository.getUserProfile(userId);

    // 5. Gather Settings for this user
    let settingsObj: Record<string, unknown> = {};
    try {
      if (userId) {
        const dbSettings = await prisma.settings.findUnique({ where: { userId } });
        if (dbSettings) {
          settingsObj = dbSettings as unknown as Record<string, unknown>;
        }
      }
    } catch {
      // Fallback
    }

    // 6. Gather Learning Summary
    const learningSummary = {
      preferredFormality: relationshipContext.communicationProfile?.preferredFormality || 'balanced',
      preferredResponseLength: relationshipContext.communicationProfile?.preferredResponseLength || 'balanced',
      frequentTopics: workingMemory.facts.slice(0, 3).map((f) => f.key),
    };

    // 7. Calculate Dynamic Token Budget Allocation (P0 -> P8)
    const tokenBudget = this.calculateDynamicTokenBudget({
      userMessage: input.userMessage,
      workingMemoryTokens: workingMemory.totalTokensEstimate,
    });

    const runtimeContext: RuntimeContext = {
      id: `ctx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date(),
      sessionId,
      userId,
      userMessage: input.userMessage,

      emotionalContext,
      relationshipContext,
      workingMemory,
      userProfile,
      settings: settingsObj,
      learningSummary,

      cognitivePlan: input.cognitivePlan,

      tokenBudget,
      providerMetadata: {
        activeProvider: providerManager.getActiveProviderId(),
        activeModel: providerManager.getActiveModelId(),
      },
    };

    logger.debug(
      {
        contextId: runtimeContext.id,
        userId,
        allocatedTokens: tokenBudget.allocatedTokens,
        assemblyTimeMs: Date.now() - startTime,
      },
      '🧩 ContextAssemblyPipeline: Assembled immutable RuntimeContext payload'
    );

    return runtimeContext;
  }

  /**
   * Calculates token budget allocation across layers P0–P8 with dynamic floating.
   */
  private calculateDynamicTokenBudget(input: {
    userMessage: string;
    workingMemoryTokens: number;
  }): RuntimeContext['tokenBudget'] {
    const totalCeiling = CONTEXT_BUDGET_CONFIG.TOTAL_CEILING_TOKENS;

    // Layer baselines
    const layerTokens: Record<string, number> = {
      'P0_SYSTEM_INSTRUCTIONS': 300,
      'P1_SAFETY_POLICY': 100,
      'P2_CURRENT_CONVERSATION': Math.ceil(input.userMessage.length / CONTEXT_BUDGET_CONFIG.CHARS_PER_TOKEN) + 100,
      'P3_RELATIONSHIP': 150,
      'P4_EMOTION': 100,
      'P5_RELEVANT_MEMORIES': Math.min(1000, input.workingMemoryTokens),
      'P6_LEARNING_SUMMARY': 150,
      'P7_PROFILE': 100,
      'P8_SETTINGS': 100,
    };

    const allocatedTokens = Object.values(layerTokens).reduce((sum, val) => sum + val, 0);

    return {
      totalCeiling,
      allocatedTokens: Math.min(totalCeiling, allocatedTokens),
      layerTokens,
    };
  }
}

/** Singleton instance export for ContextAssemblyPipeline */
export const contextAssemblyPipeline = new ContextAssemblyPipeline();
