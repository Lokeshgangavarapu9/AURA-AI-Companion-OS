/**
 * AURA Vision Intelligence — API Routes
 * Multimodal Visual Question Answering, Scene Understanding, and OCR.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { geminiService } from '../../ai/gemini.service.js';
import { sessionManager } from '../../conversation/session/session.manager.js';
import { optionalAuthenticateUser } from '../../middleware/auth.middleware.js';
import { HTTP_STATUS } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

const visionRouter = Router();

const visionSchema = z.object({
  prompt: z.string().optional().default('What do you see in this image?'),
  imageBase64: z.string().min(1, 'imageBase64 payload is required'),
  sessionId: z.string().optional(),
});

visionRouter.post('/vision/analyze', optionalAuthenticateUser, async (req: Request, res: Response) => {
  const validation = visionSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      status: 'error',
      error: {
        code: 'VALIDATION_ERROR',
        message: validation.error.issues[0]?.message || 'Invalid vision request payload',
      },
    });
    return;
  }

  const { prompt, imageBase64, sessionId } = validation.data;
  const userId = (req as any).user?.userId;

  try {
    // 1. Process Multimodal Vision Analysis via Gemini 2.5 Flash
    const visionResult = await geminiService.analyzeVision({
      prompt,
      imageBase64,
    });

    // 2. Persist to active conversation thread if sessionId provided or requested
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const newSession = await sessionManager.createSession({ title: 'Vision Conversation' }, userId);
      targetSessionId = newSession.id;
    }

    if (targetSessionId) {
      await sessionManager.appendMessage({
        sessionId: targetSessionId,
        sender: 'user',
        text: `[Camera Image Attached] ${prompt}`,
        topic: 'Vision Perception',
      });

      await sessionManager.appendMessage({
        sessionId: targetSessionId,
        sender: 'ai',
        text: visionResult.text,
        emotion: visionResult.emotion,
        topic: 'Vision Perception',
      });
    }

    logger.info({ sessionId: targetSessionId, userId }, '👁️ Vision analysis completed and stored in conversation');

    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: {
        text: visionResult.text,
        emotion: visionResult.emotion,
        sessionId: targetSessionId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error({ err }, '❌ Vision route analysis failed');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: {
        code: 'VISION_ERROR',
        message: err.message || 'Failed to process vision input',
      },
    });
  }
});

export default visionRouter;
