import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { AUTH_COOKIE, readCookie } from './security.js';

export type Role = 'Administrador' | 'Creador' | 'Analista' | 'Respondedor';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  name: string;
}

export interface MfaPendingClaims {
  mfaPending: true;
  id: string;
  mode: 'verify' | 'setup';
  jti: string;
}

declare global {
  namespace Express {
    interface Request { user?: AuthUser; mfaPending?: MfaPendingClaims }
  }
}

const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  return value;
};

export const createToken = (user: AuthUser) => jwt.sign(user, secret(), { expiresIn: '8h' });

export const createMfaPendingToken = (id: string, mode: 'verify' | 'setup') =>
  // A random jti lets the server mark this specific token as spent once the code is accepted (see
  // consumeMfaToken below), so a captured verify request cannot be replayed to mint a second session.
  jwt.sign({ mfaPending: true, id, mode, jti: crypto.randomUUID() }, secret(), { expiresIn: '5m' });

const usedMfaTokens = new Map<string, number>(); // jti -> expiry (ms epoch)
const MFA_TOKEN_TTL_MS = 5 * 60_000 + 5_000; // slightly past the token's own 5m expiry

/** True the first time this pending-MFA token is spent; false on any replay. Single-threaded Node makes this atomic. */
export function consumeMfaToken(jti: string): boolean {
  const now = Date.now();
  for (const [key, expiresAt] of usedMfaTokens) if (expiresAt < now) usedMfaTokens.delete(key);
  if (usedMfaTokens.has(jti)) return false;
  usedMfaTokens.set(jti, now + MFA_TOKEN_TTL_MS);
  return true;
}

/**
 * Authenticates a request from the HttpOnly session cookie (or a Bearer header for API clients) and re-checks the
 * user in the database, so deactivating a user, changing their role or password takes effect immediately.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '') || readCookie(req, AUTH_COOKIE);
  if (!token) return res.status(401).json({ message: 'Sesión requerida.' });
  try {
    const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] }) as AuthUser & { mfaPending?: true; iat?: number };
    if (payload.mfaPending) return res.status(401).json({ message: 'Verificación de doble factor pendiente.' });

    const result = await db.query('SELECT id, name, email, role, status, token_valid_after FROM users WHERE id = $1', [payload.id]);
    const user = result.rows[0];
    if (!user || user.status !== 'Activo') return res.status(401).json({ message: 'Sesión inválida o expirada.' });
    const validAfter = user.token_valid_after ? Math.floor(new Date(user.token_valid_after).getTime() / 1000) : 0;
    if ((payload.iat ?? 0) < validAfter) return res.status(401).json({ message: 'Sesión inválida o expirada.' });

    // Role and name always come from the database, never from the token
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  } catch {
    return res.status(401).json({ message: 'Sesión inválida o expirada.' });
  }
};

export const requireMfaPendingToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Token de verificación requerido.' });
  try {
    const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] }) as Partial<MfaPendingClaims>;
    if (!payload.mfaPending || !payload.id) return res.status(401).json({ message: 'Token de verificación inválido.' });
    req.mfaPending = payload as MfaPendingClaims;
    next();
  } catch {
    return res.status(401).json({ message: 'Token de verificación inválido o expirado.' });
  }
};

export const requireRoles = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'No tiene permisos para esta acción.' });
  next();
};
