import { describe, it, expect, vi } from 'vitest'
import { errorHandler, AppError } from './error-handler'
import { Request, Response, NextFunction } from 'express'

describe('errorHandler', () => {
  it('should return 500 with error message for generic errors', () => {
    const err = new Error('Something went wrong') as AppError
    const req = {} as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as unknown as Response
    const next = vi.fn()

    errorHandler(err, req, res, next)

    expect(res.status).toHaveBeenCalledWith(500) // FAILS: stub never calls res.status
    expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong' }) // FAILS
  })

  it('should use statusCode from AppError', () => {
    const err = new Error('Not found') as AppError
    err.statusCode = 404
    const req = {} as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as unknown as Response
    const next = vi.fn()

    errorHandler(err, req, res, next)

    expect(res.status).toHaveBeenCalledWith(404) // FAILS: stub never calls res.status
  })
})
