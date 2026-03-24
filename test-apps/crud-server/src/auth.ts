import { Request, Response, NextFunction } from 'express'

export interface AuthenticatedRequest extends Request {
  userId?: number
}

// TODO: Implement JWT authentication
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // STUB: This middleware is not implemented yet
  // Should verify JWT token from Authorization header
  // Should set req.userId on success
  // Should return 401 on missing/invalid token
  next() // Passes through without auth check — this is the bug
}

export function generateToken(userId: number): string {
  throw new Error('Not implemented')
}
