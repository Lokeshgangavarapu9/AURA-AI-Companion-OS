/**
 * AURA Reflection & Relationship Summarization Service
 * Mission 6.7: Automated reflection extraction, sentiment summarization, and milestone progression.
 */

import { geminiClient } from '../../ai/gemini.client.js';
import { IMemoryRepository } from '../storage/memory.repository.js';
import { sqliteMemoryRepository } from '../storage/sqlite.repository.js';
import { prisma } from '../../database/client.js';
import { milestoneTracker } from '../../relationship/lifecycle/milestone.tracker.js';
import { env } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export interface SummarizeSessionOptions {
  sessionId: string;
  userId?: string;
}

export class ReflectionService {
  private repository: IMemoryRepository;

  constructor(repository: IMemoryRepository = sqliteMemoryRepository) {
    this.repository = repository;
  }

  /**
   * Summarizes a conversation session into a durable Reflection insight
   * and triggers relationship milestone checks.
   */
  public async summarizeSession(options: SummarizeSessionOptions): Promise<{ summary: string; sentiment: string } | null> {
    const { sessionId, userId } = options;

    try {
      const messages = await prisma.chatMessageRecord.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: 30,
      });

      if (!messages || messages.length < 2) {
        return null;
      }

      const conversationText = messages
        .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
        .join('\n');

      let summary = 'A meaningful conversation discussing user thoughts and everyday updates.';
      let sentiment = 'positive';

      if (env.GEMINI_API_KEY) {
        try {
          const ai = geminiClient.getClient();
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are an AI Memory Reflection Analyst. Analyze this dialogue and produce a concise 1-2 sentence reflection of key user takeaways, followed by the overall emotional sentiment (positive, neutral, thoughtful, or empathetic).

Conversation:
${conversationText}

Respond ONLY in valid JSON:
{
  "summary": "1-2 sentence reflection on user's shared thoughts, preferences, or emotions",
  "sentiment": "positive"
}`,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });

          const parsed = JSON.parse(response.text || '{}');
          if (parsed.summary) summary = parsed.summary;
          if (parsed.sentiment) sentiment = parsed.sentiment;
        } catch (llmErr) {
          logger.warn({ llmErr }, 'Reflection LLM generation failed, using structured fallback reflection');
          summary = `Conversation explored topics including: ${messages[messages.length - 1]?.text.slice(0, 60)}...`;
        }
      }

      // 1. Persist Reflection to Database
      await this.repository.createReflection({
        summary,
        sentiment,
      }, userId);

      // 2. Evaluate and Award Relational Milestones
      if (userId) {
        await this.checkAndUpdateMilestones(userId, messages.length);
      }

      logger.info({ userId, sessionId, sentiment }, '✨ Successfully generated and stored memory reflection');
      return { summary, sentiment };
    } catch (err) {
      logger.error({ err, sessionId, userId }, '❌ Failed to summarize session into reflection');
      return null;
    }
  }

  /**
   * Updates user relationship milestones and total turn metrics
   */
  private async checkAndUpdateMilestones(userId: string, newTurnsCount: number): Promise<void> {
    try {
      const relState = await prisma.userRelationshipState.findUnique({
        where: { userId },
      });

      if (!relState) return;

      const currentMilestones = JSON.parse(relState.milestonesJson || '[]');
      const updatedTurns = relState.totalTurnsCount + newTurnsCount;
      const updatedTrust = Math.min(100, relState.trustScore + 0.5);

      const newMilestones = milestoneTracker.evaluateMilestones(
        currentMilestones,
        updatedTrust,
        updatedTurns,
        []
      );

      await prisma.userRelationshipState.update({
        where: { userId },
        data: {
          totalTurnsCount: updatedTurns,
          trustScore: updatedTrust,
          milestonesJson: JSON.stringify(newMilestones),
          lastInteractionAt: new Date(),
        },
      });

      logger.info({ userId, milestonesCount: newMilestones.length }, '🏆 Evaluated and updated user relationship state');
    } catch (err) {
      logger.warn({ err, userId }, 'Could not update relationship state milestones');
    }
  }
}

export const reflectionService = new ReflectionService();
