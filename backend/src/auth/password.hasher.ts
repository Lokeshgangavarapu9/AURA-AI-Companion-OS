/**
 * AURA Authentication — Password Hasher Utility
 * Secure password hashing and verification using bcrypt.
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export class PasswordHasher {
  /**
   * Hashes a plaintext password with a strong work factor salt.
   */
  public static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verifies a candidate password against a stored bcrypt hash.
   */
  public static async compare(candidate: string, hash: string): Promise<boolean> {
    return bcrypt.compare(candidate, hash);
  }
}
