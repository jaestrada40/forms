import crypto from 'node:crypto';

/** JWT_SECRET is the single root secret; it must exist (and be long enough) before the API does anything. */
export function rootSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  return value;
}

/** Independent 32-byte key per purpose (HKDF), so the session signing key is never reused for encryption or captcha. */
export function deriveKey(purpose: string): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', rootSecret(), 'formularios-institucionales', purpose, 32));
}
