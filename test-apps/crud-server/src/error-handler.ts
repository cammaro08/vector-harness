import { Request, Response, NextFunction } from 'express'

// TODO: Implement proper error handling middleware
// This is intentionally incomplete

export interface AppError extends Error {
  statusCode?: number
  isOperational?: boolean
}

// STUB: Does not properly handle errors
export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction): void {
  console.error(err) // Just logs, doesn't respond properly
  // BUG: never sends response, hangs the request
}
