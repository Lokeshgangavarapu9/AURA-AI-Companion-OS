/**
 * AURA Authentication — JWT Token Service
 * Signs and verifies cryptographically secure session tokens.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/index.js';
import { UserClaims, AuthTokens } from './auth.types.js';

export const JWT_EXPIRY = '7d';

export class TokenService {
  private static readonly secret = env.JWT_SECRET || 'aura-companion-os-production-jwt-secret-key-32chars';

  /**
   * Generates a signed JWT access token for an authenticated user.
   */
  public static generateAccessToken(claims: UserClaims): AuthTokens {
    const accessToken = jwt.sign(
      {
        userId: claims.userId,
        email: claims.email,
        name: claims.name,
        provider: claims.provider || 'local',
      },
      this.secret,
      {
        expiresIn: JWT_EXPIRY,
        issuer: 'aura-companion-os',
        audience: 'aura-client',
      }
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: JWT_EXPIRY,
    };
  }

  /**
   * Verifies and decodes a JWT access token.
   */
  public static verifyAccessToken(token: string): UserClaims {
    const decoded = jwt.verify(token, this.secret, {
      issuer: 'aura-companion-os',
      audience: 'aura-client',
    }) as jwt.JwtPayload & UserClaims;

    return {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      provider: decoded.provider,
    };
  }

  /**
   * Generates a random cryptographic token for password reset or email verification.
   */
  public static generateRandomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }
}
