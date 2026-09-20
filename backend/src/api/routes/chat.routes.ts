import { Router, Request, Response } from 'express';
import { handleChatMessage } from '../controllers/chat.controller.js';
import { optionalAuthenticateUser } from '../../middleware/auth.middleware.js';
import { HTTP_STATUS } from '../../config/index.js';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

router.use(optionalAuthenticateUser);

/**
 * POST /api/v1/chat
 * Primary chat endpoint for communicating with AI Engine.
 */
router.post('/chat', handleChatMessage);

/**
 * POST /api/v1/upload
 * Endpoint to save user attached files (Images, PDF, TXT, DOCX, Markdown).
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { filename, base64 } = req.body;
    if (!filename || !base64) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        error: {
          code: 'UPLOAD_INVALID',
          message: 'Filename and base64 content are required',
        },
      });
      return;
    }

    const uploadDir = path.join(process.cwd(), 'uploads');
    // Ensure uploads directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Clean base64 prefix if present
    const cleanBase64 = base64.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const destPath = path.join(uploadDir, filename);
    await fs.writeFile(destPath, buffer);

    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: {
        filename,
        url: `/uploads/${filename}`,
      },
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: {
        code: 'UPLOAD_FAILED',
        message: 'Failed to store uploaded file',
      },
    });
  }
});

export default router;
