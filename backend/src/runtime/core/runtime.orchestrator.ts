/**
 * AURA Core Runtime Layer — RuntimeLifecycleOrchestrator
 * Central orchestrator managing request lifecycle, state machine transitions,
 * context assembly pipeline coordination, LLM execution, and failure recovery.
 */

import { RuntimeStateMachine } from './runtime.state-machine.js';
import { ContextAssemblyPipeline, contextAssemblyPipeline } from '../context/context.pipeline.js';
import {
  RuntimeOrchestratorInput,
  RuntimeOrchestratorOutput,
  RuntimeContext,
} from '../types/runtime.types.js';
import { providerManager } from '../../ai/providers/index.js';
import { aiOrchestrator } from '../../ai/orchestrator/ai.orchestrator.js';
import { PromptBuilder } from '../../ai/prompt.builder.js';
import { logger } from '../../utils/logger.js';
import { postProcessingEngine } from '../postprocessing/postprocessing.engine.js';

export class RuntimeLifecycleOrchestrator {
  private pipeline: ContextAssemblyPipeline;

  constructor(pipeline: ContextAssemblyPipeline = contextAssemblyPipeline) {
    this.pipeline = pipeline;
  }

  /**
   * Orchestrates a complete turn lifecycle from input request to AI output.
   */
  public async executeTurn(input: RuntimeOrchestratorInput): Promise<RuntimeOrchestratorOutput> {
    const startTime = Date.now();
    const stateMachine = new RuntimeStateMachine('IDLE');
    const activeSessionId = input.sessionId || `session-${Date.now()}`;

    try {
      // 1. State: IDLE -> PERCEIVING
      stateMachine.transitionTo('PERCEIVING');

      // 2. State: PERCEIVING -> ASSEMBLING_CONTEXT
      stateMachine.transitionTo('ASSEMBLING_CONTEXT');
      const runtimeContext = await this.pipeline.assembleContext(input, activeSessionId);

      // 3. State: ASSEMBLING_CONTEXT -> ROUTING
      stateMachine.transitionTo('ROUTING');
      const systemInstruction = PromptBuilder.buildSystemInstruction(
        runtimeContext.workingMemory,
        undefined,
        runtimeContext.emotionalContext,
        runtimeContext.relationshipContext
      );

      // 4. State: ROUTING -> LLM_EXECUTION (Intelligent AI Orchestration)
      stateMachine.transitionTo('LLM_EXECUTION');
      const providerRes = await aiOrchestrator.executeOrchestratedTurn({
        prompt: input.userMessage,
        systemInstruction,
        responseFormat: 'json',
      });

      // 5. Parse response payload
      const parsed = this.parseResponse(providerRes.text, input.userMessage);
      const executionTimeMs = Date.now() - startTime;

      const output: RuntimeOrchestratorOutput = {
        sessionId: activeSessionId,
        userId: input.userId,
        responseText: parsed.text,
        emotion: parsed.emotion,
        providerUsed: providerRes.providerId,
        modelUsed: providerRes.modelUsed,
        executionTimeMs,
        runtimeContext,
      };

      // 6. State: LLM_EXECUTION -> POST_PROCESSING
      stateMachine.transitionTo('POST_PROCESSING');
      postProcessingEngine.processTurnAsync(output);

      // 7. State: POST_PROCESSING -> IDLE
      stateMachine.transitionTo('IDLE');

      logger.info(
        {
          sessionId: activeSessionId,
          provider: providerRes.providerId,
          model: providerRes.modelUsed,
          executionTimeMs,
        },
        '🚀 RuntimeLifecycleOrchestrator: Turn execution completed successfully'
      );

      return output;
    } catch (err: unknown) {
      logger.error({ err }, '❌ RuntimeLifecycleOrchestrator turn execution failed — trigger FALLBACK_RECOVERY');
      
      stateMachine.transitionTo('FALLBACK_RECOVERY');
      const fallbackOutput = this.executeFallbackRecovery(input, activeSessionId, startTime, err);
      postProcessingEngine.processTurnAsync(fallbackOutput);
      stateMachine.transitionTo('IDLE');
      
      return fallbackOutput;
    }
  }

  /**
   * Gracefully constructs fallback output when execution fails.
   */
  private executeFallbackRecovery(
    input: RuntimeOrchestratorInput,
    sessionId: string,
    startTime: number,
    err?: any
  ): RuntimeOrchestratorOutput {
    let responseText = `I heard what you said ("${input.userMessage}"), but I experienced a temporary system glitch. I'm right here with you!`;
    if (err) {
      const errMsg = String(err.message || err).toLowerCase();
      if (err.name === 'ProviderRateLimitError' || err.code === 'PROVIDER_RATE_LIMIT' || errMsg.includes('quota') || errMsg.includes('rate limit') || errMsg.includes('resource_exhausted')) {
        responseText = `I heard what you said ("${input.userMessage}"), but the AI provider's request quota has been exceeded. Please check your API keys or billing details in the backend configuration!`;
      }
    }
    return {
      sessionId,
      userId: input.userId,
      responseText,
      emotion: 'soothing',
      providerUsed: 'fallback',
      modelUsed: 'offline-fallback',
      executionTimeMs: Date.now() - startTime,
      runtimeContext: {
        id: `ctx-fallback-${Date.now()}`,
        createdAt: new Date(),
        sessionId,
        userMessage: input.userMessage,
        emotionalContext: {
          version: 1,
          primaryEmotion: 'neutral',
          detectedEmotions: [{ emotion: 'neutral', confidence: 0.8, intensity: 5 }],
          aiTone: { aiEmotion: 'soothing', responseStyle: 'gentle' },
          shortTermState: {
            currentMood: 'neutral',
            previousMood: null,
            stressLevel: 5,
            confidenceLevel: 5,
            engagementLevel: 5,
            frustrationLevel: 1,
            moodTrend: 'stable',
            moodDurationTurns: 1,
            lastUpdated: new Date(),
          },
          detectorMetadata: { source: 'fusion', confidence: 0.8, processingTimeMs: 0 },
          timestamp: new Date(),
        },
        relationshipContext: {
          version: 1,
          userId: sessionId,
          level: 'companion',
          metrics: { trustScore: 50, affinityScore: 50, relationshipHealth: 50, interactionDepth: 50, totalTurnsCount: 1 },
          signals: { curiosity: 5, gratitude: 5, openness: 5, engagement: 5, humor: 5, respect: 5, dependence: 5 },
          communicationProfile: { preferredFormality: 'balanced', preferredResponseLength: 'balanced', preferredHumor: 'subtle', preferredExplanationStyle: 'direct', preferredTechnicalDepth: 'standard', preferredEmojiUsage: 'minimal', questioningPreference: 'moderate' },
          boundaries: { professional: false, romantic: false, medical: 'strict_disclaimer', financial: 'strict_disclaimer', mentalHealthEscalation: false },
          milestones: [],
          relationshipWeight: 1.0,
          directive: { summaryPrompt: '', rules: [], safetyNotice: '' },
          timestamp: new Date(),
        },
        workingMemory: { profile: null, facts: [], preferences: [], goals: [], relationships: [], recentReflections: [], totalTokensEstimate: 0 },
        userProfile: null,
        settings: {},
        learningSummary: { preferredFormality: 'balanced', preferredResponseLength: 'balanced', frequentTopics: [] },
        tokenBudget: { totalCeiling: 4000, allocatedTokens: 0, layerTokens: {} },
        providerMetadata: { activeProvider: 'fallback', activeModel: 'none' },
      },
    };
  }

  /**
   * Safely parses JSON response from LLM output.
   */
  private parseResponse(rawText: string, fallbackPrompt: string): { text: string; emotion: string } {
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const text = typeof parsed.text === 'string' ? parsed.text : `I received: "${fallbackPrompt}"`;
      const emotion = typeof parsed.emotion === 'string' ? parsed.emotion.toLowerCase() : 'happy';
      return { text, emotion };
    } catch {
      return { text: rawText || `I'm right here with you.`, emotion: 'neutral' };
    }
  }
}

/** Singleton instance export for RuntimeLifecycleOrchestrator */
export const runtimeOrchestrator = new RuntimeLifecycleOrchestrator();
