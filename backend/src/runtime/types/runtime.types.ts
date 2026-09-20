/**
 * AURA Core Runtime Layer — Domain Types & Interfaces
 * Pure domain contracts for runtime states, context budgeting, and orchestration.
 * Multi-tenant ready with userId scoping.
 */

import { EmotionalContext } from '../../emotion/types/index.js';
import { RelationshipContext } from '../../relationship/types/index.js';
import { WorkingMemory, UserProfileEntity } from '../../memory/types/index.js';
import { CognitivePlan } from '../../cognitive/index.js';

export type RuntimeState =
  | 'IDLE'
  | 'PERCEIVING'
  | 'ASSEMBLING_CONTEXT'
  | 'ROUTING'
  | 'LLM_EXECUTION'
  | 'CAPABILITY_WAIT'
  | 'FALLBACK_RECOVERY'
  | 'POST_PROCESSING';

/** Layer Priority for Context Token Allocation (P0 to P8) */
export enum ContextLayerPriority {
  P0_SYSTEM_INSTRUCTIONS = 0,
  P1_SAFETY_POLICY = 1,
  P2_CURRENT_CONVERSATION = 2,
  P3_RELATIONSHIP = 3,
  P4_EMOTION = 4,
  P5_RELEVANT_MEMORIES = 5,
  P6_LEARNING_SUMMARY = 6,
  P7_PROFILE = 7,
  P8_SETTINGS = 8,
}

/** Immutable aggregated Context Object passed to PromptBuilder & ProviderManager */
export interface RuntimeContext {
  readonly id: string;
  readonly createdAt: Date;
  readonly sessionId: string;
  readonly userId?: string;
  readonly userMessage: string;

  // Domain Snapshots
  readonly emotionalContext: EmotionalContext;
  readonly relationshipContext: RelationshipContext;
  readonly workingMemory: WorkingMemory;
  readonly userProfile: UserProfileEntity | null;
  readonly settings: Record<string, unknown>;
  readonly learningSummary: {
    preferredFormality?: string;
    preferredResponseLength?: string;
    frequentTopics?: string[];
  };

  readonly cognitivePlan?: CognitivePlan;

  // Token Budget & Metadata
  readonly tokenBudget: {
    totalCeiling: number;
    allocatedTokens: number;
    layerTokens: Record<string, number>;
  };
  readonly providerMetadata: {
    activeProvider: string;
    activeModel: string;
  };
}

export interface RuntimeOrchestratorInput {
  userMessage: string;
  sessionId?: string;
  userId?: string;
  emotionalContext?: EmotionalContext;
  relationshipContext?: RelationshipContext;
  cognitivePlan?: CognitivePlan;
}

export interface RuntimeOrchestratorOutput {
  sessionId: string;
  userId?: string;
  responseText: string;
  emotion: string;
  providerUsed: string;
  modelUsed: string;
  executionTimeMs: number;
  runtimeContext: RuntimeContext;
}
