/**
 * AURA Authentication Middleware
 * Verifies Supabase Auth tokens (with AURA JWT fallback), extracts user identity,
 * and resolves/provisions the corresponding Neon PostgreSQL user record.
 */

import { Request, Response, NextFunction } from 'express';
import { verifySupabaseToken } from '../auth/supabase.client.js';
import { authService } from '../auth/auth.service.js';
import { UserClaims } from '../auth/auth.types.js';
import { HTTP_STATUS } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserClaims;
    }
  }
}

/**
 * Middleware requiring a valid Bearer token (Supabase JWT or AURA fallback JWT).
 * On success, resolves the Neon user record and attaches it as req.user.
 * Rejects with 401 if missing, malformed, or expired.
 */
export const authenticateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      status: 'error',
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is required to access this resource',
      },
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  try {
    // Step 1: Verify token (Supabase API → SUPABASE_JWT_SECRET → AURA TokenService fallback)
    const supabaseUser = await verifySupabaseToken(token);

    // Step 2: Resolve/provision Neon user record linked to this Supabase identity
    const neonUser = await authService.syncSupabaseUser(supabaseUser);

    // Step 3: Attach normalized UserClaims to request
    req.user = {
      userId: neonUser.id,
      email: neonUser.email,
      name: neonUser.name,
      provider: neonUser.provider,
    } as UserClaims;

    next();
  } catch (err: any) {
    logger.debug({ err: err?.message }, 'Auth middleware token rejection');

    const isExpired =
      err?.name === 'TokenExpiredError' || err?.message?.includes('expired');

    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      status: 'error',
      error: {
        code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message: isExpired
          ? 'Session has expired, please sign in again'
          : 'Invalid authentication token',
      },
    });
  }
};

/**
 * Optional authentication middleware: if Bearer token is provided, resolves req.user;
 * otherwise proceeds with req.user undefined (for public endpoints).
 */
export const optionalAuthenticateUser = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const supabaseUser = await verifySupabaseToken(token);
      const neonUser = await authService.syncSupabaseUser(supabaseUser);
      req.user = {
        userId: neonUser.id,
        email: neonUser.email,
        name: neonUser.name,
        provider: neonUser.provider,
      } as UserClaims;
    } catch {
      // Ignore token failure for optional auth — proceed unauthenticated
    }
  }

  next();
};
