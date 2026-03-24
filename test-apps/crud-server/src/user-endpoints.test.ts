import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from './index'
import { resetUsers } from './user-endpoints'

beforeEach(() => {
  resetUsers()
})

describe('GET /users', () => {
  it('should return empty array initially', async () => {
    const res = await request(app).get('/users')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('should return all users', async () => {
    await request(app).post('/users').send({ name: 'Alice', email: 'alice@test.com' })
    const res = await request(app).get('/users')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('GET /users/:id', () => {
  it('should return 404 for missing user', async () => {
    const res = await request(app).get('/users/999')
    expect(res.status).toBe(404) // FAILS: current impl returns 200 with undefined
  })

  it('should return user by id', async () => {
    await request(app).post('/users').send({ name: 'Bob', email: 'bob@test.com' })
    const res = await request(app).get('/users/1')
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Bob')
  })
})

describe('POST /users', () => {
  it('should create a user', async () => {
    const res = await request(app).post('/users').send({ name: 'Charlie', email: 'c@test.com' })
    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
  })

  it('should return 400 for missing name', async () => {
    const res = await request(app).post('/users').send({ email: 'x@test.com' })
    expect(res.status).toBe(400) // FAILS: no validation yet
  })
})

describe('DELETE /users/:id', () => {
  it('should delete a user', async () => {
    await request(app).post('/users').send({ name: 'Dave', email: 'd@test.com' })
    const res = await request(app).delete('/users/1')
    expect(res.status).toBe(204) // FAILS: route doesn't exist
  })
})
