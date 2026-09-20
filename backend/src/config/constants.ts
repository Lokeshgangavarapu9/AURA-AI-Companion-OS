/**
 * Application Constants
 * Standardized system constants, HTTP status codes, and defaults.
 */

export const APP_CONSTANTS = {
  APP_NAME: 'AURA AI Companion Engine',
  API_PREFIX: '/api/v1',
  DEFAULT_PORT: 5000,
  SUPPORTED_EMOTIONS: ['neutral', 'happy', 'thinking', 'curious', 'surprised', 'soothing'] as const,
  STATUS_MODES: ['idle', 'listening', 'thinking', 'speaking', 'vision'] as const,
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;
