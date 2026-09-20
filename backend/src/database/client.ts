import { PrismaClient } from '@prisma/client';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Global Prisma Client Singleton Instance
 * Ensures a single database connection pool is reused across all modules.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Connects to the SQLite database and logs connection status
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('🗄️ Database connected successfully (PostgreSQL / Neon)');
  } catch (error) {
    logger.error({ err: error }, '❌ Database connection failed');
    throw error;
  }
};

/**
 * Gracefully disconnects Prisma client on server shutdown
 */
export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info('🗄️ Database disconnected cleanly');
};
