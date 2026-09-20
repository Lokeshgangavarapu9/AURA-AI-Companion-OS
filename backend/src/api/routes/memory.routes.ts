import { Router, Request, Response } from 'express';
import { sqliteMemoryRepository } from '../../memory/storage/sqlite.repository.js';
import { optionalAuthenticateUser } from '../../middleware/auth.middleware.js';
import { HTTP_STATUS } from '../../config/index.js';

const router = Router();

router.use(optionalAuthenticateUser);

/**
 * GET /api/v1/memory
 * Retrieves all memory facts for the authenticated user.
 */
router.get('/memory', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const facts = await sqliteMemoryRepository.getAllMemoryFacts(50, userId);
    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: facts,
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: {
        code: 'MEMORY_FETCH_FAILED',
        message: 'Failed to retrieve memories',
      },
    });
  }
});

/**
 * DELETE /api/v1/memory/:id
 * Deletes a memory fact by ID for the authenticated user.
 */
router.delete('/memory/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const success = await sqliteMemoryRepository.deleteMemoryFact(id as string, userId);
    if (success) {
      res.status(HTTP_STATUS.OK).json({
        status: 'ok',
        data: { id, deleted: true },
      });
    } else {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        status: 'error',
        error: {
          code: 'MEMORY_NOT_FOUND',
          message: `Memory with ID ${id} not found or unauthorized`,
        },
      });
    }
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: {
        code: 'MEMORY_DELETE_FAILED',
        message: 'Failed to delete memory fact',
      },
    });
  }
});

export default router;
