/**
 * AURA Conversation Intelligence Engine — Master ConversationManager Orchestrator
 * Central orchestrator unifying Session Management, State Machine Transitions, Topic Tracking,
 * Emotion Analysis, Relationship & Personalization Analysis, and Gemini AI Execution.
 *
 * Strictly Decoupled:
 * - Does NOT compute emotions (delegated to EmotionAnalyzer).
 * - Does NOT compute relationship metrics (delegated to RelationshipAnalyzer).
 * - Does NOT build prompts (delegated to PromptBuilder via GeminiService).
 * - Does NOT know Prisma/SQLite (delegated to SessionManager/SessionRepository).
 * - Does NOT execute memory scoring (delegated to MemoryEngine via GeminiService).
 */

import { SessionManager, sessionManager } from '../session/session.manager.js';
import { ConversationStateMachine } from '../state/state.machine.js';
import { ITopicTracker, ruleBasedTopicTracker } from '../topic/topic.tracker.js';
import { geminiService, GeminiService } from '../../ai/gemini.service.js';
import { emotionAnalyzer, EmotionAnalyzer, ResponseStyle } from '../../emotion/index.js';
import { runtimeOrchestrator } from '../../runtime/index.js';
import { cognitiveEngine } from '../../cognitive/index.js';
import {
  relationshipAnalyzer,
  RelationshipAnalyzer,
  RelationshipState,
  RelationshipLevel,
  relationshipRepository,
} from '../../relationship/index.js';
import { ConversationResult, ConversationStateEnum } from '../types/index.js';
import { logger } from '../../utils/logger.js';

export interface ProcessConversationInput {
  userMessage: string;
  sessionId?: string;
  userId?: string;
}

export interface ExtendedConversationResult extends ConversationResult {
  responseStyle?: ResponseStyle;
  relationshipLevel?: RelationshipLevel;
  relationshipHealth?: number;
}

export class ConversationManager {
  private sessionManager: SessionManager;
  private topicTracker: ITopicTracker;
  private geminiService: GeminiService;
  private emotionAnalyzer: EmotionAnalyzer;
  private relationshipAnalyzer: RelationshipAnalyzer;

  /** In-memory store for active session RelationshipStates */
  private sessionRelationshipStates: Map<string, RelationshipState> = new Map();

  constructor(
    sessMgr: SessionManager = sessionManager,
    topicTrk: ITopicTracker = ruleBasedTopicTracker,
    geminiSvc: GeminiService = geminiService,
    emoAnalyzer: EmotionAnalyzer = emotionAnalyzer,
    relAnalyzer: RelationshipAnalyzer = relationshipAnalyzer
  ) {
    this.sessionManager = sessMgr;
    this.topicTracker = topicTrk;
    this.geminiService = geminiSvc;
    this.emotionAnalyzer = emoAnalyzer;
    this.relationshipAnalyzer = relAnalyzer;
  }

  /**
   * Orchestrates a single conversation turn from input message to AI response.
   * @param input User prompt and optional active sessionId and userId
   */
  public async processConversation(input: ProcessConversationInput): Promise<ExtendedConversationResult> {
    const startTime = Date.now();
    const stateMachine = new ConversationStateMachine('IDLE');

    try {
      // 1. Analyze User Emotion & Get EmotionalContext (v1)
      const emotionalContext = this.emotionAnalyzer.analyze(input.userMessage);

      // 1.5 Cognitive Intelligence Engine Planning
      const cognitivePlan = cognitiveEngine.planTurn({
        userMessage: input.userMessage,
        sessionId: input.sessionId,
      });

      // 2. Resume or create active session to get true sessionId
      let session = input.sessionId
        ? await this.sessionManager.resumeSession(input.sessionId, input.userId)
        : await this.sessionManager.createSession({ title: 'AURA Conversation' }, input.userId);

      const targetUserId = session.userId || input.userId || session.id;

      // 3. Analyze Relationship & Get RelationshipContext (v1)
      const currentRelState = await relationshipRepository.getRelationshipState(targetUserId);
      const relResult = this.relationshipAnalyzer.analyze({
        userId: targetUserId,
        userMessage: input.userMessage,
        currentState: currentRelState,
        emotionalContext,
      });

      // Update in-memory & persistent relationship state
      this.sessionRelationshipStates.set(session.id, relResult.updatedState);
      await relationshipRepository.saveRelationshipState(targetUserId, relResult.updatedState);

      // 4. State Transition: IDLE -> LISTENING
      stateMachine.transitionTo('LISTENING');

      // 5. Detect Topic & Topic Shifts
      const topicResult = this.topicTracker.detectTopic(input.userMessage, session.currentTopic);

      if (topicResult.isTopicShift) {
        logger.info(
          { from: topicResult.previousTopic, to: topicResult.currentTopic },
          '🔀 ConversationManager: Topic Shift Detected'
        );
        session = await this.sessionManager.updateSession(session.id, {
          currentTopic: topicResult.currentTopic,
        }, input.userId);
      }

      // 6. Append User Message to Session Thread
      await this.sessionManager.appendMessage({
        sessionId: session.id,
        sender: 'user',
        text: input.userMessage,
        topic: topicResult.currentTopic,
      });

      // 7. Load Recent Thread History for LLM Context
      const messageHistory = await this.sessionManager.loadRecentMessages(session.id, 10);
      const formattedHistory = messageHistory.map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      // 8. State Transition: LISTENING -> THINKING
      stateMachine.transitionTo('THINKING');

      // 9. Delegate Execution to AURA Core Runtime Orchestrator
      const runtimeResult = await runtimeOrchestrator.executeTurn({
        userMessage: input.userMessage,
        sessionId: session.id,
        userId: targetUserId,
        emotionalContext,
        relationshipContext: relResult.context,
        cognitivePlan,
      });

      const aiPayload = {
        text: runtimeResult.responseText,
        emotion: runtimeResult.emotion as any,
      };

      // 10. State Transition: THINKING -> RESPONDING
      stateMachine.transitionTo('RESPONDING');

      // 11. Append AI Response to Session Thread
      await this.sessionManager.appendMessage({
        sessionId: session.id,
        sender: 'ai',
        text: aiPayload.text,
        emotion: emotionalContext.aiTone.aiEmotion,
        topic: topicResult.currentTopic,
      });

      // 12. Fetch updated session state metadata
      const updatedSession = await this.sessionManager.resumeSession(session.id);

      // 13. State Transition: RESPONDING -> IDLE
      stateMachine.transitionTo('IDLE');

      const executionTimeMs = Date.now() - startTime;

      logger.info(
        {
          sessionId: updatedSession.id,
          topic: topicResult.currentTopic,
          emotion: emotionalContext.aiTone.aiEmotion,
          responseStyle: emotionalContext.aiTone.responseStyle,
          relationshipLevel: relResult.context.level,
          relationshipHealth: relResult.context.metrics.relationshipHealth,
          executionTimeMs,
        },
        '🎉 ConversationManager: Completed conversation turn successfully'
      );

      return {
        sessionId: updatedSession.id,
        topic: topicResult.currentTopic,
        messageCount: updatedSession.messageCount,
        aiResponse: {
          text: aiPayload.text,
          emotion: emotionalContext.aiTone.aiEmotion,
        },
        responseStyle: emotionalContext.aiTone.responseStyle,
        relationshipLevel: relResult.context.level,
        relationshipHealth: relResult.context.metrics.relationshipHealth,
        updatedContext: {
          currentTopic: topicResult.currentTopic,
          state: stateMachine.getState(),
        },
        retrievedMemoriesCount: 1,
        executionTimeMs,
        tokenUsageEstimate: Math.ceil(input.userMessage.length / 4) + Math.ceil(aiPayload.text.length / 4),
      };
    } catch (err: unknown) {
      logger.error({ err }, '❌ ConversationManager: Error during conversation turn');

      if (stateMachine.canTransitionTo('ERROR')) {
        stateMachine.transitionTo('ERROR');
      }
      stateMachine.reset();

      const executionTimeMs = Date.now() - startTime;
      return {
        sessionId: input.sessionId || 'fallback-session',
        topic: 'General',
        messageCount: 0,
        aiResponse: {
          text: 'I apologize, but I encountered a temporary error while processing your request.',
          emotion: 'soothing',
        },
        responseStyle: 'gentle',
        relationshipLevel: 'stranger',
        relationshipHealth: 15,
        updatedContext: {
          currentTopic: 'General',
          state: 'IDLE' as ConversationStateEnum,
        },
        retrievedMemoriesCount: 0,
        executionTimeMs,
        tokenUsageEstimate: 0,
      };
    }
  }
}

/** Singleton instance export for ConversationManager */
export const conversationManager = new ConversationManager();
