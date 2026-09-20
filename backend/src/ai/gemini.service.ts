import { geminiClient } from './gemini.client.js';
import { PromptBuilder, PromptBuildInput } from './prompt.builder.js';
import { memoryEngine } from '../memory/engine/memory.engine.js';
import { env, APP_CONSTANTS } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { providerManager } from './providers/index.js';

export interface GeminiResponsePayload {
  text: string;
  emotion: typeof APP_CONSTANTS.SUPPORTED_EMOTIONS[number];
}

/**
 * Gemini AI Service Layer
 * Coordinates memory retrieval, prompt building, Google AI Studio execution, and background memory extraction.
 */
export class GeminiService {
  private defaultModel = 'gemini-2.5-flash';

  /**
   * Generates AI companion response for a user chat input
   */
  public async generateChatResponse(input: PromptBuildInput): Promise<GeminiResponsePayload> {
    // If no API key is provided, return graceful fallback
    if (!env.GEMINI_API_KEY) {
      logger.info('ℹ️ GEMINI_API_KEY empty - returning offline fallback companion response');
      return {
        text: `I'm here with you! I received your message: "${input.message}". Add your GEMINI_API_KEY in backend/.env to unlock real-time Gemini AI conversations.`,
        emotion: 'happy',
      };
    }

    try {
      // 1. Retrieve Working Memory for active user message
      const workingMemory = await memoryEngine.getWorkingMemory(input.message);

      // 2. Build system instructions with injected WorkingMemory, EmotionalContext, and RelationshipContext guidance
      const systemInstruction = PromptBuilder.buildSystemInstruction(
        workingMemory,
        input.memoryContext,
        input.emotionalContext,
        input.relationshipContext
      );

      logger.debug(
        { activeProvider: providerManager.getActiveProviderId(), tokensEst: workingMemory.totalTokensEstimate },
        'Firing request through ProviderManager LLM Abstraction Layer...'
      );

      let responseText = '';

      if (env.USE_PROVIDER_ABSTRACTION) {
        const providerRes = await providerManager.generateText({
          prompt: input.message,
          systemInstruction,
          responseFormat: 'json',
        });
        responseText = providerRes.text;
      } else {
        // Legacy direct client fallback
        const ai = geminiClient.getClient();
        const contents = PromptBuilder.buildContents(input);
        const response = await ai.models.generateContent({
          model: this.defaultModel,
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        });
        responseText = response.text || '';
      }
      logger.debug({ responseText }, 'Received raw response from Gemini API');

      const parsedResult = this.parseJsonResponse(responseText, input.message);

      // 3. Asynchronously trigger background memory extraction (non-blocking)
      memoryEngine.processMessageAsync(input.message, parsedResult.text);

      return parsedResult;
    } catch (err: unknown) {
      logger.error({ err }, '❌ Gemini API call failed');
      return {
        text: `I heard what you said ("${input.message}"), but I encountered a momentary connection glitch. Let's keep chatting!`,
        emotion: 'soothing',
      };
    }
  }

  /**
   * Safely parses JSON response from Gemini model into GeminiResponsePayload
   */
  private parseJsonResponse(rawText: string, fallbackPrompt: string): GeminiResponsePayload {
    try {
      // Clean potential JSON markdown blocks if any exist
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const text = typeof parsed.text === 'string' ? parsed.text : `I received: "${fallbackPrompt}"`;
      const rawEmotion = typeof parsed.emotion === 'string' ? parsed.emotion.toLowerCase() : 'neutral';

      const validEmotion = APP_CONSTANTS.SUPPORTED_EMOTIONS.includes(rawEmotion as any)
        ? (rawEmotion as typeof APP_CONSTANTS.SUPPORTED_EMOTIONS[number])
        : 'happy';

      return { text, emotion: validEmotion };
    } catch (parseError) {
      logger.warn({ parseError, rawText }, 'Failed to parse Gemini response as JSON - using text fallback');
      return {
        text: rawText || `I'm right here with you.`,
        emotion: 'neutral',
      };
    }
  }

  /**
   * Multimodal Vision Intelligence: Visual Q&A, OCR, and scene understanding
   */
  public async analyzeVision(input: {
    prompt: string;
    imageBase64: string;
    mimeType?: string;
  }): Promise<{ text: string; emotion: typeof APP_CONSTANTS.SUPPORTED_EMOTIONS[number] }> {
    if (!env.GEMINI_API_KEY) {
      logger.info('ℹ️ GEMINI_API_KEY empty - returning offline fallback vision response');
      return {
        text: `I can see the camera frame. The image has been received and processed. Configure GEMINI_API_KEY in backend environment variables to enable live Gemini 2.5 Flash multimodal perception.`,
        emotion: 'curious',
      };
    }

    try {
      const cleanBase64 = input.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '').trim();
      const mimeType = input.mimeType || (input.imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg');

      const ai = geminiClient.getClient();
      const response = await ai.models.generateContent({
        model: this.defaultModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are AURA, an empathetic, observant, and highly intelligent AI Companion with vision perception.
The user shared a live camera image with the following question or request:
"${input.prompt || 'What do you see?'}"

Analyze the visual details carefully (objects, text/OCR, ambient environment, expression, context).
Respond directly, warmly, and insightfully as AURA.`,
              },
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
      });

      const responseText = response.text || "I see what you're showing me! Let's explore it together.";
      return {
        text: responseText,
        emotion: 'curious',
      };
    } catch (err) {
      logger.error({ err }, '❌ Vision analysis failed');
      return {
        text: "I observed the camera image, but encountered a brief processing delay. Could you please show me again?",
        emotion: 'neutral',
      };
    }
  }
}

export const geminiService = new GeminiService();
