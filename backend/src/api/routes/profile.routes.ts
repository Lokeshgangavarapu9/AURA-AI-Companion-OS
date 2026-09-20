import { Router, Request, Response } from 'express';
import { prisma } from '../../database/client.js';
import { sqliteMemoryRepository } from '../../memory/storage/sqlite.repository.js';
import { relationshipRepository } from '../../relationship/storage/relationship.repository.js';
import { authenticateUser } from '../../middleware/auth.middleware.js';
import { HTTP_STATUS } from '../../config/index.js';

const router = Router();

// All profile routes require a verified user identity
router.use(authenticateUser);

// GET /api/v1/profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.userId;
    const profile = await sqliteMemoryRepository.getUserProfile(userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Calculate user-scoped conversation count and message count
    const sessions = await prisma.conversationSession.findMany({
      where: { userId },
      include: { _count: { select: { messages: true } } },
    });

    const totalConversations = sessions.length;
    const totalMessages = sessions.reduce((sum, s) => sum + s._count.messages, 0);

    // Calculate Days Together
    let daysTogether = 1;
    const createdTimestamp = user?.createdAt || profile?.createdAt;
    if (createdTimestamp) {
      const msDiff = Date.now() - new Date(createdTimestamp).getTime();
      daysTogether = Math.max(1, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
    }

    // Get persistent relationship state from RelationshipRepository
    const relState = await relationshipRepository.getRelationshipState(userId);
    const relationshipLevel = relState.level;
    const trustScore = relState.metrics.trustScore;
    const relationshipHealth = relState.metrics.relationshipHealth;
    const milestonesCount = relState.milestones?.length || 0;
    const signalCuriosity = relState.signals?.curiosity || 5;

    // Gather favorite topics from user's message logs
    const messages = await prisma.chatMessageRecord.findMany({
      where: { session: { userId } },
      select: { topic: true },
    });

    const topicCounts: Record<string, number> = {};
    messages.forEach((m) => {
      if (m.topic) {
        topicCounts[m.topic] = (topicCounts[m.topic] || 0) + 1;
      }
    });
    const sortedTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic)
      .slice(0, 3);

    const favoriteTopics = sortedTopics.length > 0 ? sortedTopics : ['General', 'Technology'];

    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: {
        id: profile?.id || userId,
        name: profile?.name || user?.name || 'Explorer',
        email: user?.email || '',
        avatarUrl: profile?.avatarUrl || null,
        relationshipLevel,
        daysTogether,
        statistics: {
          totalConversations,
          totalMessages,
          trustScore,
          relationshipHealth,
        },
        favoriteTopics,
        achievements: [
          { name: 'First Sync', description: 'Established connection with AURA OS', achieved: true },
          { name: 'Empathic Bond', description: 'Reached trust score of 50', achieved: trustScore >= 50 },
          { name: 'Milestone Hunter', description: 'Achieve 3 milestones', achieved: milestonesCount >= 3 },
        ],
        badges: [
          { name: 'Pioneer', category: 'achievement' },
          relationshipLevel !== 'stranger' ? { name: 'Friend', category: 'relationship' } : null,
          signalCuriosity > 7 ? { name: 'Curious', category: 'emotion' } : null,
        ].filter(Boolean),
        personalization: {
          nickname: profile?.name || user?.name || 'Explorer',
          companionName: 'AURA',
          language: 'English (US)',
          theme: 'Obsidian',
        },
      },
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: {
        code: 'PROFILE_FETCH_FAILED',
        message: 'Failed to retrieve profile analytics',
      },
    });
  }
});

// POST /api/v1/profile
router.post('/profile', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.userId;
    const { name, age, occupation, college, bio, avatarUrl } = req.body;

    // Update or create Profile details in DB (email changes are not allowed via profile endpoint)
    const profile = await sqliteMemoryRepository.updateUserProfile(
      {
        name,
        age: age ? parseInt(age, 10) : undefined,
        occupation,
        college,
        bio,
        avatarUrl,
      },
      userId
    );

    // Update User display name if provided
    if (name) {
      await prisma.user.update({
        where: { id: userId },
        data: { name },
      });
    }

    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: profile,
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: {
        code: 'PROFILE_UPDATE_FAILED',
        message: 'Failed to save profile changes',
      },
    });
  }
});

export default router;
