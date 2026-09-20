import { Router, Request, Response } from 'express';
import { sqliteMemoryRepository } from '../../memory/storage/sqlite.repository.js';
import { authenticateUser } from '../../middleware/auth.middleware.js';
import { HTTP_STATUS } from '../../config/index.js';

const router = Router();

router.use(authenticateUser);

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

/**
 * GET /api/v1/memory/reflections
 * Retrieves recent reflections for authenticated user.
 */
router.get('/memory/reflections', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const reflections = await sqliteMemoryRepository.getRecentReflections(10, userId);
    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: reflections,
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: { code: 'REFLECTIONS_FETCH_FAILED', message: 'Failed to retrieve reflections' },
    });
  }
});

/**
 * POST /api/v1/memory/reflect
 * Generates an executive reflection summary and updates relationship milestones.
 */
router.post('/memory/reflect', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { sessionId } = req.body;
    if (!sessionId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'sessionId is required for reflection' },
      });
      return;
    }

    const { reflectionService } = await import('../../memory/processors/reflection.service.js');
    const result = await reflectionService.summarizeSession({ sessionId, userId });

    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: result || { summary: 'Session analyzed', sentiment: 'neutral' },
    });
  } catch (error: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: { code: 'REFLECTION_FAILED', message: error.message },
    });
  }
});

/**
 * GET /api/v1/memory/search
 * Hybrid search across user memories using keywords and semantic ranking.
 */
router.get('/memory/search', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const query = String(req.query.q || '');
    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);

    const facts = await sqliteMemoryRepository.getAllMemoryFacts(50, userId);
    const { MemoryRanker } = await import('../../memory/ranking/ranker.js');
    const ranked = MemoryRanker.rankMemories(facts, keywords, { topK: 15 });

    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: ranked.map((r) => ({
        fact: r.fact,
        score: r.score.finalScore,
        breakdown: r.score,
      })),
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: { code: 'MEMORY_SEARCH_FAILED', message: 'Memory search failed' },
    });
  }
});

export default router;
