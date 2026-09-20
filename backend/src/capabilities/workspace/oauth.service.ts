/**
 * AURA Google Workspace OAuth 2.0 Service
 * Mission 6.6: Secure Authorization, Callback Resolution, and Token Refresh
 */

import { env } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { OAuthTokens, ALL_WORKSPACE_SCOPES } from './workspace.types.js';

export class GoogleWorkspaceOAuthService {
  private readonly clientId = env.GOOGLE_CLIENT_ID;
  private readonly clientSecret = env.GOOGLE_CLIENT_SECRET;
  private readonly redirectUri = env.GOOGLE_REDIRECT_URI;

  public isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generates standard Google OAuth 2.0 Consent URL
   */
  public getAuthorizationUrl(userId: string, stateNonce?: string): string {
    if (!this.isConfigured()) {
      throw new Error(
        'Google Workspace OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment.'
      );
    }

    const state = JSON.stringify({
      userId,
      nonce: stateNonce || Math.random().toString(36).substring(2),
    });

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: ALL_WORKSPACE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: Buffer.from(state).toString('base64url'),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges OAuth authorization code for Access & Refresh tokens
   */
  public async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    if (!this.isConfigured()) {
      throw new Error('Google Workspace OAuth is not configured');
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Failed to exchange authorization code');
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        scope: data.scope || '',
        tokenType: data.token_type || 'Bearer',
      };
    } catch (error: any) {
      logger.error({ err: error }, '❌ OAuth code exchange failed');
      throw error;
    }
  }

  /**
   * Refreshes an expired access token using the stored refresh token
   */
  public async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    if (!this.isConfigured()) {
      throw new Error('Google Workspace OAuth is not configured');
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Failed to refresh access token');
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Google may not re-issue refresh token
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        scope: data.scope || '',
        tokenType: data.token_type || 'Bearer',
      };
    } catch (error: any) {
      logger.error({ err: error }, '❌ OAuth token refresh failed');
      throw error;
    }
  }
}

export const googleOAuthService = new GoogleWorkspaceOAuthService();
