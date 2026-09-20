/**
 * AURA API Configuration
 * Manages environment-derived base URLs, timeouts, and retry settings.
 */

export const API_CONFIG = {
  /** Base URL for all API requests derived from Vite environment variables */
  BASE_URL: (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, ''),
  /** WebSocket Voice Gateway URL supporting local and cloud deployments */
  WS_VOICE_URL: (
    import.meta.env.VITE_WS_URL ||
    (import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws').replace(/\/api\/v1\/?$/, '/ws/voice')
      : `ws://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:5000/ws/voice`)
  ),
  /** Default timeout in milliseconds for HTTP requests */
  DEFAULT_TIMEOUT_MS: 8000,
  /** Maximum number of retry attempts for transient network or 5xx server failures */
  MAX_RETRIES: 2,
  /** Initial delay in milliseconds before retrying failed requests */
  RETRY_DELAY_MS: 1000,
} as const;
