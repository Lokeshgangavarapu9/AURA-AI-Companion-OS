/**
 * AURA Security Audit Logger
 * Mission 6.9: Security Event Auditing, Intrusion Detection, and Rate Limit Logging
 */

import { logger } from '../utils/logger.js';

export type SecurityEventType =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_REGISTER_SUCCESS'
  | 'AUTH_REGISTER_FAILED'
  | 'AUTH_LOGOUT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'
  | 'SUSPICIOUS_PAYLOAD_BLOCKED'
  | 'CORS_VIOLATION'
  | 'CSRF_STATE_INVALID';

export interface SecurityAuditEntry {
  type: SecurityEventType;
  ip?: string;
  userId?: string;
  path?: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export class SecurityAuditLogger {
  public log(entry: SecurityAuditEntry): void {
    const record = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    };

    const isFailure =
      entry.type.includes('FAILED') ||
      entry.type.includes('EXCEEDED') ||
      entry.type.includes('BLOCKED') ||
      entry.type.includes('VIOLATION') ||
      entry.type.includes('UNAUTHORIZED');

    if (isFailure) {
      logger.warn(record, `🛡️ SECURITY AUDIT [ALERT]: ${entry.type} from IP: ${entry.ip || 'unknown'}`);
    } else {
      logger.info(record, `🛡️ SECURITY AUDIT [INFO]: ${entry.type} for user: ${entry.userId || 'anonymous'}`);
    }
  }
}

export const securityAuditLogger = new SecurityAuditLogger();
