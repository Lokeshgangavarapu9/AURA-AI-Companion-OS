/**
 * AURA Memory Engine — Gemini Memory Extractor Service
 * Receives ONLY MemoryCandidate snippets (not full chat history) and structures them into clean JSON.
 * Persists profile updates, facts, preferences, goals, and relationships into storage via IMemoryRepository.
 * Fully user-isolated.
 */

import { geminiClient } from '../../ai/gemini.client.js';
import { IMemoryRepository } from '../storage/memory.repository.js';
import { sqliteMemoryRepository } from '../storage/sqlite.repository.js';
import { MemoryCandidate } from './detector.js';
import { env } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export interface StructuredMemoryPayload {
  profileUpdates?: {
    name?: string;
    age?: number;
    occupation?: string;
    college?: string;
    bio?: string;
  };
  preferences?: Array<{ key: string; value: string }>;
  goals?: Array<{ key: string; value: string }>;
  relationships?: Array<{ key: string; value: string }>;
  facts?: Array<{ key: string; value: string }>;
}

export class MemoryExtractorService {
  private repository: IMemoryRepository;

  constructor(repository: IMemoryRepository = sqliteMemoryRepository) {
    this.repository = repository;
  }

  /**
   * Processes MemoryCandidate list via Gemini JSON extraction and persists structured items to database
   * @param candidates Filtered candidate statements produced by MemoryDetector
   * @param userId Target user ID for tenant isolation
   */
  public async extractAndStore(candidates: MemoryCandidate[], userId?: string): Promise<boolean> {
    if (!candidates || candidates.length === 0 || !env.GEMINI_API_KEY) {
      return false;
    }

    try {
      const candidatesText = candidates.map((c) => `- Category [${c.category}]: "${c.rawText}"`).join('\n');

      const prompt = `You are an AI Memory Extraction Processor.
Extract structured user information from the following candidate statements.

Candidate Statements:
${candidatesText}

Respond ONLY with valid JSON matching this schema:
{
  "profileUpdates": {
    "name": "string or omit",
    "age": number or omit,
    "occupation": "string or omit",
    "college": "string or omit",
    "bio": "string or omit"
  },
  "preferences": [ { "key": "string", "value": "string" } ],
  "goals": [ { "key": "string", "value": "string" } ],
  "relationships": [ { "key": "string", "value": "string" } ],
  "facts": [ { "key": "string", "value": "string" } ]
}`;

      const ai = geminiClient.getClient();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1, // Low temperature for deterministic extraction
        },
      });

      const rawText = response.text || '{}';
      const parsed: StructuredMemoryPayload = JSON.parse(rawText);

      // Persist Profile Updates
      if (parsed.profileUpdates && Object.keys(parsed.profileUpdates).length > 0) {
        await this.repository.updateUserProfile(parsed.profileUpdates, userId);
        logger.info({ profileUpdates: parsed.profileUpdates, userId }, '✅ MemoryExtractor updated UserProfile');
      }

      // Persist Preferences
      if (parsed.preferences && parsed.preferences.length > 0) {
        for (const pref of parsed.preferences) {
          await this.repository.createMemoryFact({
            category: 'preference',
            key: pref.key,
            value: pref.value,
            importance: 8,
          }, userId);
        }
      }

      // Persist Goals
      if (parsed.goals && parsed.goals.length > 0) {
        for (const goal of parsed.goals) {
          await this.repository.createMemoryFact({
            category: 'goal',
            key: goal.key,
            value: goal.value,
            importance: 8,
          }, userId);
        }
      }

      // Persist Relationships
      if (parsed.relationships && parsed.relationships.length > 0) {
        for (const rel of parsed.relationships) {
          await this.repository.createMemoryFact({
            category: 'relationship',
            key: rel.key,
            value: rel.value,
            importance: 9,
          }, userId);
        }
      }

      // Persist Facts
      if (parsed.facts && parsed.facts.length > 0) {
        for (const fact of parsed.facts) {
          await this.repository.createMemoryFact({
            category: 'fact',
            key: fact.key,
            value: fact.value,
            importance: 7,
          }, userId);
        }
      }

      logger.info({ userId }, '🎉 MemoryExtractor successfully processed and saved memories to database');
      return true;
    } catch (err) {
      logger.error({ err, userId }, '❌ MemoryExtractor Service failed');
      return false;
    }
  }
}

/** Singleton export for MemoryExtractorService */
export const memoryExtractorService = new MemoryExtractorService();
