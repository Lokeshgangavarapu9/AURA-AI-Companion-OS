/**
 * AURA Conversation Intelligence Engine — Pure Domain Types & Contracts
 * Single Source of Truth for all conversation-related types.
 * Contains ZERO runtime code, ZERO database dependencies, and ZERO LLM framework imports.
 */

/** Valid states for the AURA Conversation State Machine */
export type ConversationStateEnum =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'RESPONDING'
  | 'WAITING'
  | 'EXECUTING'
  | 'ERROR';

/** Sender classification for chat message logs */
export type ChatMessageSender = 'user' | 'ai';

/** Domain entity representing a stored Chat Message Record */
export interface ChatMessageEntity {
  id: string;
  sessionId: string;
  sender: ChatMessageSender;
  text: string;
  emotion: string | null;
  topic: string | null;
  createdAt: Date;
}

/** Domain entity representing a Conversation Session */
export interface SessionMetadata {
  id: string;
  userId?: string;
  title: string | null;
  currentTopic: string | null;
  messageCount: number;
  isPinned: boolean;
  lastInteractionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Data Transfer Object for creating a new ConversationSession */
export interface CreateSessionDto {
  title?: string;
  initialTopic?: string;
  userId?: string;
}

/** Data Transfer Object for appending a message to a session */
export interface AppendMessageDto {
  sessionId: string;
  sender: ChatMessageSender;
  text: string;
  emotion?: string;
  topic?: string;
}

/** Result structure produced by the Topic Tracker */
export interface TopicResult {
  currentTopic: string;
  previousTopic: string | null;
  isTopicShift: boolean;
  confidence: number;
}

/** Runtime context assembled per conversation turn */
export interface ConversationContextPayload {
  sessionId: string;
  conversationId: string;
  currentTopic: string;
  previousTopic: string | null;
  conversationSummary: string | null;
  messageCount: number;
  lastInteractionAt: Date;
  currentEmotion: string;
  activeGoals: string[];
  pendingQuestions: string[];
}

/** Final output payload returned by the ConversationManager */
export interface ConversationResult {
  sessionId: string;
  topic: string;
  messageCount: number;
  aiResponse: {
    text: string;
    emotion: string;
  };
  updatedContext: {
    currentTopic: string;
    state: ConversationStateEnum;
  };
  retrievedMemoriesCount: number;
  executionTimeMs: number;
  tokenUsageEstimate: number;
}
