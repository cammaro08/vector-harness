import { Router, Request, Response } from 'express'

export interface User {
  id: number
  name: string
  email: string
}

// In-memory store for testing
let users: User[] = []
let nextId = 1

export const userRouter = Router()

// GET /users — list all
userRouter.get('/', (req: Request, res: Response) => {
  res.json(users)
})

// GET /users/:id — get one (MISSING: returns 404 when not found)
userRouter.get('/:id', (req: Request, res: Response) => {
  const user = users.find(u => u.id === parseInt(req.params.id))
  res.json(user) // BUG: should return 404 if not found
})

// POST /users — create (MISSING: input validation)
userRouter.post('/', (req: Request, res: Response) => {
  const user: User = { id: nextId++, ...req.body }
  users.push(user)
  res.status(201).json(user)
})

// PUT /users/:id — update (MISSING: returns wrong status code)
userRouter.put('/:id', (req: Request, res: Response) => {
  const idx = users.findIndex(u => u.id === parseInt(req.params.id))
  if (idx === -1) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  users[idx] = { ...users[idx], ...req.body }
  res.json(users[idx])
})

// DELETE /users/:id — INTENTIONALLY MISSING

export function resetUsers() {
  users = []
  nextId = 1
}
