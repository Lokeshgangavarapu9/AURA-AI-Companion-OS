/**
 * AURA Relationship & Personalization Engine — Persistent Database Repository
 * Stores and retrieves user-scoped RelationshipState in PostgreSQL/SQLite via Prisma.
 * Strictly preserves all domain models and pure analysis algorithms.
 */

import { prisma } from '../../database/client.js';
import { RelationshipState } from '../types/index.js';
import { relationshipAnalyzer } from '../analyzer/relationship.analyzer.js';
import { logger } from '../../utils/logger.js';

export class RelationshipRepository {
  /**
   * Loads the persistent RelationshipState for a given user.
   * If none exists yet, creates and persists a clean initial state.
   */
  public async getRelationshipState(userId: string): Promise<RelationshipState> {
    try {
      const record = await prisma.userRelationshipState.findUnique({
        where: { userId },
      });

      if (!record) {
        const initialState = relationshipAnalyzer.createInitialState(userId);
        await this.saveRelationshipState(userId, initialState);
        return initialState;
      }

      // Reconstruct domain entity from persistent columns
      return {
        version: 1,
        userId,
        level: record.level as any,
        metrics: {
          trustScore: record.trustScore,
          affinityScore: record.affinityScore,
          relationshipHealth: record.relationshipHealth,
          interactionDepth: record.interactionDepth,
          totalTurnsCount: record.totalTurnsCount,
        },
        signals: record.signalsJson ? JSON.parse(record.signalsJson) : {
          curiosity: 5, gratitude: 3, openness: 4, engagement: 5, humor: 2, respect: 6, dependence: 2,
        },
        communicationProfile: record.profileJson ? JSON.parse(record.profileJson) : {
          preferredFormality: 'balanced',
          preferredResponseLength: 'balanced',
          preferredHumor: 'subtle',
          preferredExplanationStyle: 'direct',
          preferredTechnicalDepth: 'standard',
          preferredEmojiUsage: 'minimal',
          questioningPreference: 'moderate',
        },
        boundaries: record.boundariesJson ? JSON.parse(record.boundariesJson) : {
          professional: false,
          romantic: false,
          medical: 'strict_disclaimer',
          financial: 'strict_disclaimer',
          mentalHealthEscalation: false,
        },
        milestones: record.milestonesJson ? JSON.parse(record.milestonesJson) : [],
        events: record.eventsJson ? JSON.parse(record.eventsJson) : [],
        history: record.historyJson ? JSON.parse(record.historyJson) : [],
        lastInteractionAt: record.lastInteractionAt,
      };
    } catch (err) {
      logger.error({ err, userId }, '⚠️ Error loading persistent relationship state — falling back to initial state');
      return relationshipAnalyzer.createInitialState(userId);
    }
  }

  /**
   * Persists updated RelationshipState to the database for this user.
   */
  public async saveRelationshipState(userId: string, state: RelationshipState): Promise<void> {
    try {
      await prisma.userRelationshipState.upsert({
        where: { userId },
        create: {
          userId,
          level: state.level,
          trustScore: state.metrics.trustScore,
          affinityScore: state.metrics.affinityScore,
          relationshipHealth: state.metrics.relationshipHealth,
          interactionDepth: state.metrics.interactionDepth,
          totalTurnsCount: state.metrics.totalTurnsCount,
          signalsJson: JSON.stringify(state.signals),
          profileJson: JSON.stringify(state.communicationProfile),
          boundariesJson: JSON.stringify(state.boundaries),
          milestonesJson: JSON.stringify(state.milestones),
          eventsJson: JSON.stringify(state.events),
          historyJson: JSON.stringify(state.history),
          lastInteractionAt: state.lastInteractionAt || new Date(),
        },
        update: {
          level: state.level,
          trustScore: state.metrics.trustScore,
          affinityScore: state.metrics.affinityScore,
          relationshipHealth: state.metrics.relationshipHealth,
          interactionDepth: state.metrics.interactionDepth,
          totalTurnsCount: state.metrics.totalTurnsCount,
          signalsJson: JSON.stringify(state.signals),
          profileJson: JSON.stringify(state.communicationProfile),
          boundariesJson: JSON.stringify(state.boundaries),
          milestonesJson: JSON.stringify(state.milestones),
          eventsJson: JSON.stringify(state.events),
          historyJson: JSON.stringify(state.history),
          lastInteractionAt: state.lastInteractionAt || new Date(),
        },
      });

      logger.debug({ userId, level: state.level }, '💾 Persisted user relationship state to database');
    } catch (err) {
      logger.error({ err, userId }, '❌ Failed to persist user relationship state');
    }
  }
}

export const relationshipRepository = new RelationshipRepository();
