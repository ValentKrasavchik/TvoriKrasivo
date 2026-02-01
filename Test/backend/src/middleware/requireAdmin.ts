import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AdminPayload {
  sub: string;
  login: string;
  iat?: number;
  exp?: number;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.adminToken;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Admin token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminPayload;
    (req as any).admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}
