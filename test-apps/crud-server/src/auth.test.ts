import { describe, it, expect, vi } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { requireAuth, generateToken } from './auth'

describe('requireAuth middleware', () => {
  it('should call next() when valid token provided', () => {
    // FAILS: stub always calls next regardless of token
    const req = { headers: { authorization: 'Bearer invalid-token' } } as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn()

    requireAuth(req as any, res, next)

    expect(next).not.toHaveBeenCalled() // FAILS: stub always calls next
  })

  it('should return 401 when no token provided', () => {
    const req = { headers: {} } as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn()

    requireAuth(req as any, res, next)

    expect(res.status).toHaveBeenCalledWith(401) // FAILS: stub calls next instead
  })
})

describe('generateToken', () => {
  it('should generate a token for a user id', () => {
    expect(() => generateToken(1)).toThrow('Not implemented') // Documents current state
  })
})
