import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/** Hash a password with scrypt. Format: scrypt$saltHex$hashHex */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

/** Verify password against stored hash. Also accepts legacy plaintext for migration. */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;

  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hash] = parts;
    const computed = scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(hash, 'hex');
    if (computed.length !== storedBuf.length) return false;
    return timingSafeEqual(computed, storedBuf);
  }

  // Legacy plaintext (bootstrap only) — constant-time-ish compare
  const a = Buffer.from(password);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
