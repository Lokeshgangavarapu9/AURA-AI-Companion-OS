/**
 * Authentication API Service — Multi-Tenant SaaS Identity
 * Connects frontend sessions to backend JWT authentication and user isolation.
 */

import { httpClient } from '../client.js';
import { ENDPOINTS } from '../endpoints.js';
import { ApiResult } from '../types.js';

export interface UserClaims {
  id: string;
  email: string;
  name: string;
  provider?: string;
  isVerified?: boolean;
  createdAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: string;
}

export interface AuthResponseData {
  user: UserClaims;
  tokens: AuthTokens;
}

export interface AuthApiResponse {
  status: 'ok';
  data: AuthResponseData;
}

export interface MeResponseData {
  user: UserClaims;
  profile?: any;
  settings?: any;
  relationship?: any;
}

export interface MeApiResponse {
  status: 'ok';
  data: MeResponseData;
}

export interface ForgotPasswordResponseData {
  message: string;
  token?: string;
}

const TOKEN_KEY = 'aura_token';

export const authService = {
  /**
   * Registers a new user account with initial profile, settings, and relationship state
   */
  async register(params: {
    email: string;
    password: string;
    name: string;
  }): Promise<ApiResult<AuthApiResponse>> {
    const res = await httpClient.post<AuthApiResponse>(ENDPOINTS.AUTH.REGISTER, params);
    if (res.success && res.data?.data?.tokens?.accessToken) {
      this.setToken(res.data.data.tokens.accessToken);
    }
    return res;
  },

  /**
   * Authenticates existing user credentials and returns JWT session
   */
  async login(params: {
    email: string;
    password: string;
  }): Promise<ApiResult<AuthApiResponse>> {
    const res = await httpClient.post<AuthApiResponse>(ENDPOINTS.AUTH.LOGIN, params);
    if (res.success && res.data?.data?.tokens?.accessToken) {
      this.setToken(res.data.data.tokens.accessToken);
    }
    return res;
  },

  /**
   * Retrieves active authenticated user session, scoped profile, settings, and relationship
   */
  async getMe(): Promise<ApiResult<MeApiResponse>> {
    return httpClient.get<MeApiResponse>(ENDPOINTS.AUTH.ME);
  },

  /**
   * Requests a password reset token
   */
  async forgotPassword(email: string): Promise<ApiResult<{ status: 'ok'; data: ForgotPasswordResponseData }>> {
    return httpClient.post<{ status: 'ok'; data: ForgotPasswordResponseData }>(
      ENDPOINTS.AUTH.FORGOT_PASSWORD,
      { email }
    );
  },

  /**
   * Completes a password reset with a valid token
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<ApiResult<{ status: 'ok'; data: { message: string } }>> {
    return httpClient.post<{ status: 'ok'; data: { message: string } }>(
      ENDPOINTS.AUTH.RESET_PASSWORD,
      { token, newPassword }
    );
  },

  /**
   * Signs out the user, clears stored credentials, and dispatches an auth change event
   */
  async logout(): Promise<void> {
    try {
      await httpClient.post(ENDPOINTS.AUTH.LOGOUT);
    } catch {
      // Ignore network errors on logout
    } finally {
      this.clearToken();
      window.dispatchEvent(new CustomEvent('aura:auth_state_changed', { detail: { user: null } }));
    }
  },

  /**
   * Retrieves current JWT access token from localStorage
   */
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Saves JWT access token to localStorage and dispatches auth event
   */
  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      window.dispatchEvent(new CustomEvent('aura:auth_state_changed', { detail: { token } }));
    } catch (e) {
      console.warn('Failed to persist auth token', e);
    }
  },

  /**
   * Clears JWT access token from localStorage
   */
  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.warn('Failed to clear auth token', e);
    }
  },

  /**
   * Checks whether an access token exists
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};
