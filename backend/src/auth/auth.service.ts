/**
 * AURA Authentication & Identity Service
 * Core business logic for user management, credential validation,
 * automated tenant provisioning, and password recovery.
 */

import { prisma } from '../database/client.js';
import { PasswordHasher } from './password.hasher.js';
import { TokenService } from './token.service.js';
import {
  RegisterDto,
  LoginDto,
  AuthResponseData,
  OAuthProfileDto,
  AuthenticatedUserPayload,
} from './auth.types.js';
import { logger } from '../utils/logger.js';

export class AuthService {
  /**
   * Registers a new user account with isolated tenant resources:
   * Profile, default Settings, and initial Relationship State.
   */
  public async register(dto: RegisterDto): Promise<AuthResponseData> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check if account already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      const error: any = new Error('An account with this email already exists');
      error.statusCode = 409;
      error.code = 'EMAIL_ALREADY_EXISTS';
      throw error;
    }

    const passwordHash = await PasswordHasher.hash(dto.password);

    // Create user and associated initial tenant entities in transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: dto.name.trim(),
          passwordHash,
          provider: 'local',
          isVerified: true, // Ready for verification flow
        },
      });

      // Initialize default UserProfile
      await tx.userProfile.create({
        data: {
          userId: user.id,
          name: dto.name.trim(),
          bio: 'Ready to explore with AURA',
        },
      });

      // Initialize default Settings
      await tx.settings.create({
        data: {
          userId: user.id,
          theme: 'obsidian',
          personality: 'aura-gentle',
          conversationStyle: 'empathic',
        },
      });

      // Initialize default RelationshipState
      await tx.userRelationshipState.create({
        data: {
          userId: user.id,
          level: 'stranger',
          trustScore: 10,
          affinityScore: 10,
          relationshipHealth: 15,
          interactionDepth: 20,
        },
      });

      return user;
    });

    logger.info({ userId: newUser.id, email: newUser.email }, '✅ User account registered successfully');

    const tokens = TokenService.generateAccessToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      provider: newUser.provider,
    });

    return {
      user: this.mapUser(newUser),
      tokens,
      profile: {
        name: newUser.name,
        bio: 'Ready to explore with AURA',
      },
    };
  }

  /**
   * Authenticates user credentials and issues a session access token.
   */
  public async login(dto: LoginDto): Promise<AuthResponseData> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        profile: true,
      },
    });

    if (!user || !user.passwordHash) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const isValid = await PasswordHasher.compare(dto.password, user.passwordHash);
    if (!isValid) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = TokenService.generateAccessToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
    });

    logger.info({ userId: user.id, email: user.email }, '✅ User logged in successfully');

    return {
      user: this.mapUser(user),
      tokens,
      profile: user.profile
        ? {
            name: user.profile.name,
            bio: user.profile.bio,
            avatarUrl: user.profile.avatarUrl,
          }
        : null,
    };
  }

  /**
   * Retrieves profile, settings, and status for the currently authenticated user.
   */
  public async getMe(userId: string): Promise<AuthenticatedUserPayload & { profile: any; settings: any }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        settings: true,
        relationshipState: true,
      },
    });

    if (!user) {
      const error: any = new Error('User not found');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    return {
      ...this.mapUser(user),
      profile: user.profile,
      settings: user.settings,
    };
  }

  /**
   * Generates a password reset token.
   */
  public async requestPasswordReset(email: string): Promise<{ token: string; email: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      // Do not reveal email existence to prevent user enumeration attacks
      return { token: 'mock-token-to-prevent-enumeration', email: normalizedEmail };
    }

    const resetToken = TokenService.generateRandomToken(32);
    const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour validity

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    logger.info({ userId: user.id, email: user.email }, '🔑 Password reset token generated');

    return { token: resetToken, email: user.email };
  }

  /**
   * Resets user password using a valid reset token.
   */
  public async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      const error: any = new Error('Password reset token is invalid or has expired');
      error.statusCode = 400;
      error.code = 'INVALID_RESET_TOKEN';
      throw error;
    }

    const passwordHash = await PasswordHasher.hash(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    logger.info({ userId: user.id }, '✅ Password reset successfully completed');
    return true;
  }

  /**
   * OAuth Integration Architecture: Authenticates or registers an OAuth user
   * (Google, GitHub, Apple, Microsoft).
   */
  public async oauthLogin(profile: OAuthProfileDto): Promise<AuthResponseData> {
    const normalizedEmail = profile.email.trim().toLowerCase();

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    });

    if (!user) {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: normalizedEmail,
            name: profile.name,
            provider: profile.provider,
            providerId: profile.providerId,
            isVerified: true,
          },
        });

        await tx.userProfile.create({
          data: {
            userId: created.id,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
          },
        });

        await tx.settings.create({
          data: {
            userId: created.id,
          },
        });

        await tx.userRelationshipState.create({
          data: {
            userId: created.id,
          },
        });

        return tx.user.findUniqueOrThrow({
          where: { id: created.id },
          include: { profile: true },
        });
      });
    }

    const tokens = TokenService.generateAccessToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
    });

    return {
      user: this.mapUser(user),
      tokens,
      profile: user.profile
        ? {
            name: user.profile.name,
            avatarUrl: user.profile.avatarUrl,
          }
        : null,
    };
  }

  private mapUser(user: any): AuthenticatedUserPayload {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      isVerified: user.isVerified ?? true,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
