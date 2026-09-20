/**
 * AURA Authentication — Controller Layer
 * Handles incoming authentication requests with strict Zod validation.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from './auth.service.js';
import { HTTP_STATUS } from '../config/index.js';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(1, 'Name is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export const authController = {
  /**
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error.issues[0]?.message || 'Invalid registration data',
        },
      });
      return;
    }

    try {
      const result = await authService.register(validation.data);
      res.status(HTTP_STATUS.CREATED).json({
        status: 'ok',
        data: result,
      });
    } catch (err: any) {
      const status = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
      res.status(status).json({
        status: 'error',
        error: {
          code: err.code || 'REGISTRATION_FAILED',
          message: err.message || 'Failed to register account',
        },
      });
    }
  },

  /**
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error.issues[0]?.message || 'Invalid login credentials format',
        },
      });
      return;
    }

    try {
      const result = await authService.login(validation.data);
      res.status(HTTP_STATUS.OK).json({
        status: 'ok',
        data: result,
      });
    } catch (err: any) {
      const status = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
      res.status(status).json({
        status: 'error',
        error: {
          code: err.code || 'LOGIN_FAILED',
          message: err.message || 'Failed to authenticate',
        },
      });
    }
  },

  /**
   * GET /api/v1/auth/me
   */
  async getMe(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        status: 'error',
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    try {
      const result = await authService.getMe(userId);
      res.status(HTTP_STATUS.OK).json({
        status: 'ok',
        data: result,
      });
    } catch (err: any) {
      const status = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
      res.status(status).json({
        status: 'error',
        error: {
          code: err.code || 'PROFILE_FETCH_FAILED',
          message: err.message || 'Failed to load user profile',
        },
      });
    }
  },

  /**
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    const validation = forgotPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error.issues[0]?.message || 'Invalid email',
        },
      });
      return;
    }

    try {
      const result = await authService.requestPasswordReset(validation.data.email);
      res.status(HTTP_STATUS.OK).json({
        status: 'ok',
        data: {
          message: 'If an account exists with that email, a password reset link has been dispatched.',
          token: result.token, // Returned in dev/test environment for easy verification
        },
      });
    } catch (err: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        error: {
          code: 'PASSWORD_RESET_FAILED',
          message: 'Failed to process password reset request',
        },
      });
    }
  },

  /**
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error.issues[0]?.message || 'Invalid reset request',
        },
      });
      return;
    }

    try {
      await authService.resetPassword(validation.data.token, validation.data.newPassword);
      res.status(HTTP_STATUS.OK).json({
        status: 'ok',
        data: { message: 'Password has been reset successfully. You may now log in.' },
      });
    } catch (err: any) {
      const status = err.statusCode || HTTP_STATUS.BAD_REQUEST;
      res.status(status).json({
        status: 'error',
        error: {
          code: err.code || 'RESET_FAILED',
          message: err.message || 'Failed to reset password',
        },
      });
    }
  },

  /**
   * POST /api/v1/auth/logout
   */
  async logout(_req: Request, res: Response): Promise<void> {
    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: { message: 'Logged out successfully' },
    });
  },
};
