/**
 * AURA Workspace Token Storage & Lifecycle Manager
 * Mission 6.6: Secure, multi-tenant scoped token storage with automatic refresh.
 */

import { prisma } from '../../database/client.js';
import { logger } from '../../utils/logger.js';
import { OAuthTokens, WorkspaceConnectionStatus } from './workspace.types.js';
import { googleOAuthService } from './oauth.service.js';

export class WorkspaceTokenStorage {
  private readonly CATEGORY = 'workspace_token';
  private readonly KEY = 'google';

  /**
   * Persists OAuth tokens safely scoped by userId
   */
  public async saveTokens(userId: string, tokens: OAuthTokens): Promise<void> {
    const existing = await prisma.memoryFact.findFirst({
      where: {
        userId,
        category: this.CATEGORY,
        key: this.KEY,
      },
    });

    const payloadString = JSON.stringify(tokens);

    if (existing) {
      await prisma.memoryFact.update({
        where: { id: existing.id },
        data: {
          value: payloadString,
          lastUsedAt: new Date(),
        },
      });
    } else {
      await prisma.memoryFact.create({
        data: {
          userId,
          category: this.CATEGORY,
          key: this.KEY,
          value: payloadString,
          confidence: 1.0,
          importance: 10,
        },
      });
    }

    logger.info({ userId }, '🔒 Stored Google Workspace OAuth tokens for user');
  }

  /**
   * Retrieves active access token for user, automatically refreshing if expired
   */
  public async getValidAccessToken(userId: string): Promise<string | null> {
    const record = await prisma.memoryFact.findFirst({
      where: {
        userId,
        category: this.CATEGORY,
        key: this.KEY,
      },
    });

    if (!record) return null;

    try {
      const tokens: OAuthTokens = JSON.parse(record.value);
      const isExpired = Date.now() >= tokens.expiresAt - 60000; // 1 minute buffer

      if (!isExpired) {
        return tokens.accessToken;
      }

      if (tokens.refreshToken) {
        logger.info({ userId }, '🔄 Access token expired, refreshing via Google OAuth...');
        const refreshed = await googleOAuthService.refreshAccessToken(tokens.refreshToken);
        await this.saveTokens(userId, refreshed);
        return refreshed.accessToken;
      }

      return null;
    } catch (err) {
      logger.error({ err, userId }, '❌ Failed to parse or refresh workspace tokens');
      return null;
    }
  }

  /**
   * Returns current connection status and available services for user
   */
  public async getConnectionStatus(userId: string): Promise<WorkspaceConnectionStatus> {
    const record = await prisma.memoryFact.findFirst({
      where: {
        userId,
        category: this.CATEGORY,
        key: this.KEY,
      },
    });

    if (!record) {
      return {
        connected: false,
        scopes: [],
        services: {
          gmail: false,
          calendar: false,
          drive: false,
          docs: false,
          tasks: false,
        },
      };
    }

    try {
      const tokens: OAuthTokens = JSON.parse(record.value);
      const scopes = tokens.scope ? tokens.scope.split(' ') : [];

      return {
        connected: true,
        scopes,
        expiresAt: new Date(tokens.expiresAt).toISOString(),
        services: {
          gmail: scopes.some((s) => s.includes('gmail')),
          calendar: scopes.some((s) => s.includes('calendar')),
          drive: scopes.some((s) => s.includes('drive')),
          docs: scopes.some((s) => s.includes('documents')),
          tasks: scopes.some((s) => s.includes('tasks')),
        },
      };
    } catch {
      return {
        connected: false,
        scopes: [],
        services: {
          gmail: false,
          calendar: false,
          drive: false,
          docs: false,
          tasks: false,
        },
      };
    }
  }

  /**
   * Revokes and removes tokens for user
   */
  public async clearTokens(userId: string): Promise<void> {
    await prisma.memoryFact.deleteMany({
      where: {
        userId,
        category: this.CATEGORY,
        key: this.KEY,
      },
    });
    logger.info({ userId }, '🗑️ Cleared Google Workspace tokens for user');
  }
}

export const workspaceTokenStorage = new WorkspaceTokenStorage();
