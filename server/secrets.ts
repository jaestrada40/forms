import crypto from 'node:crypto';

// Secrets stored in the database (SMTP password, MFA seeds) are encrypted at rest with AES-256-GCM,
// using a key derived from JWT_SECRET. Format: base64(iv).base64(tag).base64(ciphertext)
const secretKey = () => crypto.createHash('sha256').update(process.env.JWT_SECRET ?? 'formularios').digest();

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}

export function decryptSecret(token: string): string {
  const [iv, tag, data] = token.split('.').map(p => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Encrypted values contain two dots; legacy plaintext (base32 MFA seeds) never does. */
export const isEncryptedSecret = (value: string) => value.split('.').length === 3;

/** Returns the plaintext of a stored secret, accepting legacy unencrypted values. */
export const readSecret = (stored: string) => (isEncryptedSecret(stored) ? decryptSecret(stored) : stored);
