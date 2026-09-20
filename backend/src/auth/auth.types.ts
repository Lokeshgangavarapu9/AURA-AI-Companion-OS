/**
 * AURA Authentication & Identity System — Type Definitions
 * Extensible, provider-agnostic domain interfaces for users, sessions, and credentials.
 */

export interface AuthenticatedUserPayload {
  id: string;
  email: string;
  name: string;
  provider: string;
  isVerified: boolean;
  createdAt: Date;
}

export interface UserClaims {
  userId: string;
  email: string;
  name: string;
  provider?: string;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface AuthResponseData {
  user: AuthenticatedUserPayload;
  tokens: AuthTokens;
  profile?: {
    name?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
  } | null;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface OAuthProfileDto {
  provider: 'google' | 'github' | 'apple' | 'microsoft';
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}
