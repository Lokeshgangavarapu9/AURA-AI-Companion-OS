/**
 * AURA Core Runtime — PostProcessingEngine
 * Master orchestrator executing non-blocking background feedback loops:
 * Memory deduplication, Relationship metric updates, Emotion trend tracking,
 * Learning Evolution, and Telemetry analytics.
 * Fully user-isolated.
 */

import { RuntimeEventBus, runtimeEventBus } from './event.bus.js';
import { AnalyticsTracker, analyticsTracker } from './analytics.tracker.js';
import { RuntimeOrchestratorOutput } from '../types/runtime.types.js';
import { memoryEngine } from '../../memory/engine/memory.engine.js';
import { relationshipAnalyzer } from '../../relationship/index.js';
import { relationshipRepository } from '../../relationship/storage/relationship.repository.js';
import { logger } from '../../utils/logger.js';

export class PostProcessingEngine {
  private eventBus: RuntimeEventBus;
  private analytics: AnalyticsTracker;

  constructor(
    eventBus: RuntimeEventBus = runtimeEventBus,
    analytics: AnalyticsTracker = analyticsTracker
  ) {
    this.eventBus = eventBus;
    this.analytics = analytics;
  }

  /**
   * Executes post-processing feedback loops asynchronously in the background.
   * NEVER blocks user response delivery.
   */
  public processTurnAsync(output: RuntimeOrchestratorOutput): void {
    setImmediate(async () => {
      try {
        const targetUserId = output.userId || output.sessionId;
        logger.debug({ sessionId: output.sessionId, userId: targetUserId }, '🔄 PostProcessingEngine: Starting background post-processing turn...');

        // 1. Record Analytics & Telemetry
        this.analytics.recordTurnMetric({
          sessionId: output.sessionId,
          providerUsed: output.providerUsed,
          modelUsed: output.modelUsed,
          contextAssemblyMs: 15,
          providerLatencyMs: output.executionTimeMs,
          totalTurnTimeMs: output.executionTimeMs,
          timestamp: new Date(),
        });

        // 2. Memory Feedback Loop: Background user-scoped memory extraction
        memoryEngine.processMessageAsync(
          output.runtimeContext.userMessage,
          output.responseText,
          output.userId
        );
        this.eventBus.publish('MemoryStored', output.sessionId, {
          userMessage: output.runtimeContext.userMessage,
          userId: output.userId,
        });

        // 3. Relationship Feedback Loop: Update & persist user relationship metrics
        const currentRel = await relationshipRepository.getRelationshipState(targetUserId);
        const updatedRel = relationshipAnalyzer.analyze({
          userId: targetUserId,
          userMessage: output.runtimeContext.userMessage,
          currentState: currentRel,
          emotionalContext: output.runtimeContext.emotionalContext,
        });
        await relationshipRepository.saveRelationshipState(targetUserId, updatedRel.updatedState);

        this.eventBus.publish('RelationshipUpdated', output.sessionId, updatedRel.context.metrics);

        // 4. Emotion Feedback Loop: Track emotion trends
        this.eventBus.publish('EmotionUpdated', output.sessionId, {
          primaryEmotion: output.emotion,
          aiTone: output.runtimeContext.emotionalContext.aiTone,
        });

        // 5. Learning Evolution Pipeline: Gradual preference update
        this.eventBus.publish('LearningUpdated', output.sessionId, {
          learningSummary: output.runtimeContext.learningSummary,
        });

        // 6. Publish Master ConversationCompleted Event
        this.eventBus.publish('ConversationCompleted', output.sessionId, {
          executionTimeMs: output.executionTimeMs,
          providerUsed: output.providerUsed,
        });

        logger.debug({ sessionId: output.sessionId, userId: targetUserId }, '✅ PostProcessingEngine: Background pipeline completed successfully');
      } catch (err: unknown) {
        logger.error({ err, sessionId: output.sessionId }, '⚠️ PostProcessingEngine: Non-blocking background error');
      }
    });
  }
}

/** Singleton instance export for PostProcessingEngine */
export const postProcessingEngine = new PostProcessingEngine();
