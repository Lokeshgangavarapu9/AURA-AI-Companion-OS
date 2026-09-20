/**
 * AURA Authentication Middleware
 * Enforces JWT session validation, tenant identity extraction, and protected route access.
 */

import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../auth/token.service.js';
import { UserClaims } from '../auth/auth.types.js';
import { HTTP_STATUS } from '../config/index.js';

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserClaims;
    }
  }
}

/**
 * Middleware requiring a valid JWT Bearer token.
 * Rejects requests with 401 Unauthorized if missing, malformed, or expired.
 */
export const authenticateUser = (req: Request, res: Response, next: NextFunction): void => {
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
    const claims = TokenService.verifyAccessToken(token);
    req.user = claims;
    next();
  } catch (err: any) {
    const isExpired = err.name === 'TokenExpiredError';
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      status: 'error',
      error: {
        code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message: isExpired ? 'Session has expired, please sign in again' : 'Invalid authentication token',
      },
    });
  }
};

/**
 * Optional authentication middleware: if Bearer token is provided, decodes and attaches req.user;
 * otherwise proceeds with req.user undefined.
 */
export const optionalAuthenticateUser = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      req.user = TokenService.verifyAccessToken(token);
    } catch {
      // Ignore token failure for optional auth
    }
  }

  next();
};
