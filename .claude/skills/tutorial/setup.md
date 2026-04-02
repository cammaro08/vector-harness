# Vector v2 Tutorial: Setup

## Goal

Bootstrap a minimal Express + TypeScript todo API that serves as the foundation for all Vector v2 tutorial exercises. The app implements a simple in-memory CRUD API with test coverage using vitest and supertest.

## Prerequisites

- Node.js 18+ installed
- npm available in PATH
- Basic familiarity with Express.js and TypeScript
- A terminal with git configured

## Steps

### 1. Create project directory and initialize

```bash
mkdir vector-tutorial
cd vector-tutorial
npm init -y
```

### 2. Install dependencies

```bash
npm install express
npm install -D typescript vitest supertest @types/express @types/supertest tsx
```

### 3. Create `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. Update `package.json` with scripts

Add the following to the `scripts` section in `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "build": "tsc",
    "start": "tsx src/server.ts"
  }
}
```

### 5. Create `src/app.ts`

```typescript
import express, { Express, Request, Response } from 'express';

interface Todo {
  id: number;
  title: string;
}

let todos: Todo[] = [];
let nextId = 1;

export const createApp = (): Express => {
  const app = express();

  app.use(express.json());

  // GET /todos - list all todos
  app.get('/todos', (req: Request, res: Response) => {
    res.json(todos);
  });

  // POST /todos - create a new todo
  app.post('/todos', (req: Request, res: Response) => {
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'title is required and must be a string' });
      return;
    }

    const newTodo: Todo = {
      id: nextId++,
      title: title.trim(),
    };

    todos.push(newTodo);
    res.status(201).json(newTodo);
  });

  // DELETE /todos/:id - delete a todo by id
  app.delete('/todos/:id', (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'id must be a number' });
      return;
    }

    const index = todos.findIndex((t) => t.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'todo not found' });
      return;
    }

    todos.splice(index, 1);
    res.status(204).send();
  });

  return app;
};

// Helper function to reset state (for testing)
export const resetTodos = (): void => {
  todos = [];
  nextId = 1;
};
```

### 6. Create `src/server.ts`

```typescript
import { createApp } from './app';

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

### 7. Create `src/app.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp, resetTodos } from './app';

describe('Todo API', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    resetTodos();
    app = createApp();
  });

  describe('GET /todos', () => {
    it('should return an empty array initially', async () => {
      const res = await request(app).get('/todos');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return all todos', async () => {
      await request(app).post('/todos').send({ title: 'Buy milk' });
      await request(app).post('/todos').send({ title: 'Walk dog' });

      const res = await request(app).get('/todos');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({ id: 1, title: 'Buy milk' });
      expect(res.body[1]).toMatchObject({ id: 2, title: 'Walk dog' });
    });
  });

  describe('POST /todos', () => {
    it('should create a new todo with auto-assigned id', async () => {
      const res = await request(app)
        .post('/todos')
        .send({ title: 'Learn TypeScript' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: 1,
        title: 'Learn TypeScript',
      });
    });

    it('should increment id for each new todo', async () => {
      await request(app).post('/todos').send({ title: 'First' });
      const res = await request(app).post('/todos').send({ title: 'Second' });

      expect(res.body.id).toBe(2);
    });

    it('should trim whitespace from title', async () => {
      const res = await request(app)
        .post('/todos')
        .send({ title: '  Trimmed title  ' });

      expect(res.body.title).toBe('Trimmed title');
    });

    it('should return 400 if title is missing', async () => {
      const res = await request(app).post('/todos').send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 if title is not a string', async () => {
      const res = await request(app)
        .post('/todos')
        .send({ title: 123 });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /todos/:id', () => {
    it('should delete a todo by id', async () => {
      await request(app).post('/todos').send({ title: 'To delete' });

      const res = await request(app).delete('/todos/1');
      expect(res.status).toBe(204);

      const listRes = await request(app).get('/todos');
      expect(listRes.body).toEqual([]);
    });

    it('should return 404 if todo does not exist', async () => {
      const res = await request(app).delete('/todos/999');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 if id is not a number', async () => {
      const res = await request(app).delete('/todos/invalid');

      expect(res.status).toBe(400);
    });

    it('should not affect other todos', async () => {
      await request(app).post('/todos').send({ title: 'Keep me' });
      await request(app).post('/todos').send({ title: 'Delete me' });
      await request(app).post('/todos').send({ title: 'Keep me too' });

      await request(app).delete('/todos/2');

      const listRes = await request(app).get('/todos');
      expect(listRes.body).toHaveLength(2);
      expect(listRes.body[0].id).toBe(1);
      expect(listRes.body[1].id).toBe(3);
    });
  });
});
```

### 8. Create `.gitignore`

```
node_modules
dist
.env
.env.local
coverage
```

### 9. Initialize git repository

```bash
git init
git add -A
git commit -m "initial: crud todo app"
```

## Verify

Run tests to confirm everything works:

```bash
npm test
```

You should see output similar to:

```
✓ src/app.test.ts (11 tests) 10ms
```

All 11 tests should pass (3 GET tests, 5 POST tests, 3 DELETE tests).

Optionally, start the server to verify it runs:

```bash
npm start
```

You should see:

```
Server running on http://localhost:3000
```

Press `Ctrl+C` to stop.

## What's Next

You now have a working CRUD todo API. Head to [Exercise 1](./exercise-1.md) to initialize Vector in this project.
