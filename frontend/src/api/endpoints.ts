/**
 * AURA Centralized Endpoints Registry
 * Eliminates hardcoded URL strings across the codebase.
 */

export const ENDPOINTS = {
  HEALTH: '/health',

  CHAT: {
    SEND_MESSAGE: '/chat',
    GET_HISTORY: '/chat/history',
    CLEAR_HISTORY: '/chat/history/clear',
    UPLOAD: '/upload',
  },

  SESSIONS: {
    LIST: '/sessions',
    GET_BY_ID: (id: string) => `/sessions/${id}`,
    CREATE: '/sessions',
    UPDATE: (id: string) => `/sessions/${id}`,
    DELETE: (id: string) => `/sessions/${id}`,
  },

  MEMORY: {
    GET_MEMORIES: '/memory',
    SEARCH: '/memory/search',
    DELETE: '/memory/:id',
  },

  VOICE: {
    TRANSCRIBE: '/voice/transcribe',
    SYNTHESIZE: '/voice/synthesize',
  },

  VISION: {
    ANALYZE_FRAME: '/vision/analyze',
  },

  PROFILE: {
    GET: '/profile',
    UPDATE: '/profile',
  },

  SETTINGS: {
    GET: '/settings',
    UPDATE: '/settings',
  },

  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    ME: '/auth/me',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    LOGOUT: '/auth/logout',
  },
} as const;
