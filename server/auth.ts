import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

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
  jwt.sign({ mfaPending: true, id, mode }, secret(), { expiresIn: '5m' });

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Sesión requerida.' });
  try {
    const payload = jwt.verify(token, secret()) as AuthUser & { mfaPending?: true };
    if (payload.mfaPending) return res.status(401).json({ message: 'Verificación de doble factor pendiente.' });
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Sesión inválida o expirada.' });
  }
};

export const requireMfaPendingToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Token de verificación requerido.' });
  try {
    const payload = jwt.verify(token, secret()) as Partial<MfaPendingClaims>;
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
