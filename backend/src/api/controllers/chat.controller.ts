import { Request, Response } from 'express';
import { z } from 'zod';
import { conversationManager } from '../../conversation/manager/conversation.manager.js';
import { HTTP_STATUS } from '../../config/index.js';

// Zod Schema for incoming chat request validation
const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  sessionId: z.string().optional(),
});

/**
 * Chat Controller
 * Handles POST /api/v1/chat endpoint requests using ConversationManager master orchestrator.
 * Scoped to authenticated user.
 */
export const handleChatMessage = async (req: Request, res: Response): Promise<void> => {
  const validation = chatRequestSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      status: 'error',
      error: {
        code: 'VALIDATION_ERROR',
        message: validation.error.issues[0]?.message || 'Invalid chat request body',
      },
    });
    return;
  }

  const { message, sessionId } = validation.data;
  const userId = (req as any).user?.userId;

  // Process conversation turn through ConversationManager
  const result = await conversationManager.processConversation({
    userMessage: message,
    sessionId,
    userId,
  });

  const now = new Date();
  const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  res.status(HTTP_STATUS.OK).json({
    status: 'ok',
    data: {
      id: `msg-${Date.now()}`,
      sessionId: result.sessionId,
      text: result.aiResponse.text,
      emotion: result.aiResponse.emotion,
      responseStyle: result.responseStyle ?? 'direct',
      relationshipLevel: result.relationshipLevel ?? 'stranger',
      relationshipHealth: result.relationshipHealth ?? 15,
      topic: result.topic,
      messageCount: result.messageCount,
      timestamp,
    },
  });
};
