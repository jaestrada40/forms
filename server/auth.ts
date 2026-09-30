import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export type Role = 'Administrador' | 'Creador' | 'Analista' | 'Respondedor';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  name: string;
}

declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  return value;
};

export const createToken = (user: AuthUser) => jwt.sign(user, secret(), { expiresIn: '8h' });

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Sesión requerida.' });
  try {
    req.user = jwt.verify(token, secret()) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ message: 'Sesión inválida o expirada.' });
  }
};

export const requireRoles = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'No tiene permisos para esta acción.' });
  next();
};
