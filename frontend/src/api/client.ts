/**
 * AURA Core HTTP Client
 * Enterprise-grade fetch wrapper with interceptors, retries, timeout, and global error handling.
 */

import { API_CONFIG } from './config.js';
import {
  ApiResult,
  RequestOptions,
  RequestInterceptor,
  ResponseInterceptor,
  ApiErrorPayload,
} from './types.js';

export class HttpClient {
  private baseUrl: string;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(baseUrl: string = API_CONFIG.BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Registers a middleware function executed before every outgoing HTTP request.
   */
  public addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Registers a middleware function executed on every HTTP response or error.
   */
  public addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Executes an HTTP request with timeout, retries, and interceptors.
   */
  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
    let opts = { ...options };

    // Apply Request Interceptors
    if (!opts.skipInterceptors) {
      for (const interceptor of this.requestInterceptors) {
        opts = await interceptor(opts);
      }
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const maxRetries = opts.retries ?? API_CONFIG.MAX_RETRIES;
    const timeoutMs = opts.timeoutMs ?? API_CONFIG.DEFAULT_TIMEOUT_MS;

    let result: ApiResult<T> = { success: false, error: 'Uninitialized' };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...opts,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(opts.headers as Record<string, string>),
          },
          signal: controller.signal,
        });

        clearTimeout(timer);
        const data = await response.json();

        if (response.ok) {
          result = { success: true, data: data as T, statusCode: response.status };
          break;
        }

        const errorMsg = (data as ApiErrorPayload)?.error?.message || `HTTP ${response.status} Error`;
        const errorCode = (data as ApiErrorPayload)?.error?.code || 'HTTP_ERROR';
        result = { success: false, error: errorMsg, statusCode: response.status, code: errorCode };

        // Do not retry 4xx client errors
        if (response.status >= 400 && response.status < 500) {
          break;
        }
      } catch (err: unknown) {
        clearTimeout(timer);
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        const errorMsg = isTimeout ? `Request timed out after ${timeoutMs}ms` : 'Network error / Server unreachable';

        result = {
          success: false,
          error: errorMsg,
          code: isTimeout ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR',
        };
      }

      // Exponential backoff before retry attempt
      if (attempt < maxRetries) {
        const delay = API_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Apply Response Interceptors
    if (!opts.skipInterceptors) {
      for (const interceptor of this.responseInterceptors) {
        result = await interceptor(result);
      }
    }

    return result;
  }

  /** Performs a GET request */
  public async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /** Performs a POST request */
  public async post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /** Performs a PUT request */
  public async put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /** Performs a PATCH request */
  public async patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /** Performs a DELETE request */
  public async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export Singleton HttpClient Instance
export const httpClient = new HttpClient();

// Automatically attach Bearer token to all outgoing authenticated requests
httpClient.addRequestInterceptor(async (opts) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('aura_token');
    if (token) {
      opts.headers = {
        ...opts.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return opts;
});

// Handle 401 Unauthorized gracefully by clearing invalid session token
httpClient.addResponseInterceptor(async (result) => {
  if (result.statusCode === 401 && typeof window !== 'undefined') {
    const hadToken = !!localStorage.getItem('aura_token');
    if (hadToken) {
      localStorage.removeItem('aura_token');
      window.dispatchEvent(new CustomEvent('aura:unauthorized'));
    }
  }
  return result;
});
