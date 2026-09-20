import { Router, Request, Response } from 'express';
import { prisma } from '../../database/client.js';
import { optionalAuthenticateUser } from '../../middleware/auth.middleware.js';
import { HTTP_STATUS } from '../../config/index.js';

const router = Router();

router.use(optionalAuthenticateUser);

/**
 * Resolves effective userId from request claims or baseline user.
 */
async function getEffectiveUserId(req: Request): Promise<string> {
  const userId = (req as any).user?.userId;
  if (userId) return userId;

  const existing = await prisma.user.findFirst();
  if (existing) return existing.id;

  const created = await prisma.user.create({
    data: {
      email: 'user@aura.os',
      name: 'Alex',
      provider: 'local',
    },
  });
  return created.id;
}

// GET /api/v1/settings
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const userId = await getEffectiveUserId(req);

    let settings = await prisma.settings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: { userId },
      });
    }

    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: settings,
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: {
        code: 'SETTINGS_FETCH_FAILED',
        message: 'Failed to retrieve settings',
      },
    });
  }
});

// PUT /api/v1/settings
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const userId = await getEffectiveUserId(req);

    // Remove immutable fields if present in req.body
    const { id: _id, userId: _uId, createdAt: _cAt, updatedAt: _uAt, ...updateData } = req.body;

    const updated = await prisma.settings.upsert({
      where: { userId },
      update: updateData,
      create: {
        ...updateData,
        userId,
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: updated,
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: {
        code: 'SETTINGS_UPDATE_FAILED',
        message: 'Failed to update settings',
      },
    });
  }
});

export default router;
