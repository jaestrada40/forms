import crypto from 'node:crypto';
import { deriveKey, rootSecret } from './keys.js';

// Secrets stored in the database (SMTP password, MFA seeds, captcha secret) are encrypted at rest with AES-256-GCM,
// using a key derived (HKDF) from JWT_SECRET for this purpose only. Format: base64(iv).base64(tag).base64(ciphertext)
const secretKey = () => deriveKey('secrets-at-rest');
// Values written before the HKDF key existed used SHA-256(JWT_SECRET); they are still readable and are
// re-encrypted with the new key the next time they are saved.
const legacyKey = () => crypto.createHash('sha256').update(rootSecret()).digest();

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}

function decryptWith(key: Buffer, token: string): string {
  const [iv, tag, data] = token.split('.').map(p => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function decryptSecret(token: string): string {
  try { return decryptWith(secretKey(), token); } catch { return decryptWith(legacyKey(), token); }
}

/** Encrypted values contain two dots; legacy plaintext (base32 MFA seeds) never does. */
export const isEncryptedSecret = (value: string) => value.split('.').length === 3;

/** Returns the plaintext of a stored secret, accepting legacy unencrypted values. */
export const readSecret = (stored: string) => (isEncryptedSecret(stored) ? decryptSecret(stored) : stored);

/** True when a stored secret is already encrypted with the current key (not the legacy SHA-256 one). */
export function usesCurrentKey(token: string): boolean {
  try { decryptWith(secretKey(), token); return true; } catch { return false; }
}
