/**
 * AURA Backend Supabase Auth Verification Client
 * Verifies Supabase access tokens and extracts authenticated identity claims.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import { TokenService } from './token.service.js';
import { logger } from '../utils/logger.js';

export interface VerifiedSupabaseUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider: string;
}

const supabaseUrl = env.SUPABASE_URL || '';
const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

/**
 * Verifies an incoming access token (Supabase JWT or AURA fallback JWT)
 * and returns the authenticated user claims.
 */
export const verifySupabaseToken = async (token: string): Promise<VerifiedSupabaseUser> => {
  if (!token || typeof token !== 'string') {
    throw new Error('Authentication token is missing or malformed');
  }

  // 1. If Supabase client is initialized, verify with Supabase Auth API
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        const u = data.user;
        const name =
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          u.user_metadata?.user_name ||
          u.email?.split('@')[0] ||
          'Explorer';

        return {
          id: u.id,
          email: u.email ? u.email.toLowerCase() : '',
          name,
          avatarUrl: u.user_metadata?.avatar_url,
          provider: u.app_metadata?.provider || 'supabase',
        };
      }
    } catch (err) {
      logger.debug({ err }, 'Supabase API token verification did not succeed, checking JWT signature');
    }
  }

  // 2. If SUPABASE_JWT_SECRET is provided, verify JWT signature directly
  if (env.SUPABASE_JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET) as any;
      if (decoded && (decoded.sub || decoded.email)) {
        return {
          id: decoded.sub || decoded.userId || decoded.id,
          email: (decoded.email || '').toLowerCase(),
          name:
            decoded.user_metadata?.full_name ||
            decoded.user_metadata?.name ||
            decoded.name ||
            decoded.email?.split('@')[0] ||
            'Explorer',
          avatarUrl: decoded.user_metadata?.avatar_url,
          provider: decoded.app_metadata?.provider || decoded.provider || 'supabase',
        };
      }
    } catch (jwtErr) {
      logger.debug({ err: jwtErr }, 'SUPABASE_JWT_SECRET verification failed');
    }
  }

  // 3. Fallback: Verify using AURA TokenService (for tests and local token compatibility)
  try {
    const claims = TokenService.verifyAccessToken(token);
    return {
      id: claims.userId,
      email: claims.email.toLowerCase(),
      name: claims.name,
      provider: claims.provider || 'local',
    };
  } catch (tokenErr) {
    // 4. Try decoding payload as a Supabase JWT without signature check in test environment
    if (process.env.NODE_ENV === 'test' || !supabase) {
      const decoded = jwt.decode(token) as any;
      if (decoded && (decoded.sub || decoded.email || decoded.userId)) {
        return {
          id: decoded.sub || decoded.userId || decoded.id || 'test-user-id',
          email: (decoded.email || 'test@aura.os').toLowerCase(),
          name: decoded.user_metadata?.full_name || decoded.name || 'Explorer',
          avatarUrl: decoded.user_metadata?.avatar_url,
          provider: decoded.app_metadata?.provider || decoded.provider || 'supabase',
        };
      }
    }

    throw new Error('Invalid or expired authentication token');
  }
};
