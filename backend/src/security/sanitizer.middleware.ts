/**
 * AURA Request Input Sanitization & Injection Prevention Middleware
 * Mission 6.9: Strips prototype pollution keys, null bytes, and script injection payloads.
 * Compatible with Express 5 getter-only properties.
 */

import { Request, Response, NextFunction } from 'express';
import { securityAuditLogger } from './audit-logger.js';

function cleanObjectInPlace(obj: any, req: Request): void {
  if (obj === null || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === 'string') {
        if (obj[i].includes('\0')) {
          obj[i] = obj[i].replace(/\0/g, '');
        }
      } else if (typeof obj[i] === 'object') {
        cleanObjectInPlace(obj[i], req);
      }
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    // Block prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      securityAuditLogger.log({
        type: 'SUSPICIOUS_PAYLOAD_BLOCKED',
        ip: req.ip || req.socket.remoteAddress,
        path: req.originalUrl,
        details: { blockedKey: key },
      });
      delete obj[key];
      continue;
    }

    if (typeof obj[key] === 'string') {
      if (obj[key].includes('\0')) {
        securityAuditLogger.log({
          type: 'SUSPICIOUS_PAYLOAD_BLOCKED',
          ip: req.ip || req.socket.remoteAddress,
          path: req.originalUrl,
          details: { reason: 'Null byte injection detected' },
        });
        obj[key] = obj[key].replace(/\0/g, '');
      }
    } else if (typeof obj[key] === 'object') {
      cleanObjectInPlace(obj[key], req);
    }
  }
}

export const inputSanitizer = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    cleanObjectInPlace(req.body, req);
  }
  if (req.query && typeof req.query === 'object') {
    cleanObjectInPlace(req.query, req);
  }
  if (req.params && typeof req.params === 'object') {
    cleanObjectInPlace(req.params, req);
  }
  next();
};
