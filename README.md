# Multiplayer Quiz App

A Kahoot-style real-time multiplayer quiz application. Hosts create and manage quizzes; participants join via a room code and compete on a live leaderboard.

## Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React + Vite | Vercel |
| Backend | NestJS + Socket.IO | Railway |
| Database | PostgreSQL | Neon (serverless) |
| ORM | TypeORM | — |
| Monorepo | pnpm workspaces | — |

## Project Structure

```
multiplayer-quiz-app/
├── packages/
│   ├── shared/       # TypeScript types, DTOs, enums shared between FE and BE
│   ├── backend/      # NestJS application
│   └── frontend/     # React + Vite application
├── Dockerfile
├── railway.toml
├── vercel.json
└── pnpm-workspace.yaml
```

## Local Development

```bash
# Install all dependencies from the repo root (creates workspace symlinks)
pnpm install

# Run backend and frontend in parallel
pnpm --filter @quiz/backend dev
pnpm --filter @quiz/frontend dev
```

Required environment variables:

**`packages/backend/.env`**
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
FRONTEND_ORIGIN=http://localhost:5173
```

**`packages/frontend/.env`**
```
VITE_API_URL=http://localhost:3000
```

## Monorepo & Shared Package

`packages/shared` is compiled to `dist/` before consumers build. When `pnpm install` runs from the root, pnpm creates symlinks so each package can resolve `@quiz/shared`:

```
packages/backend/node_modules/@quiz/shared  →  ../../shared
packages/frontend/node_modules/@quiz/shared →  ../../shared
```

**`pnpm install` must always run from the repo root** — in local dev, CI, and both deployment platforms.

## Deployment

### Vercel (frontend)

Do **not** set the Vercel project root to `packages/frontend` — that would cut off access to `packages/shared`. Configure from the repo root:

| Setting | Value |
|---|---|
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm --filter @quiz/shared build && pnpm --filter @quiz/frontend build` |
| Output directory | `packages/frontend/dist` |

Add environment variable `VITE_API_URL` pointing to the Railway backend URL.

### Railway (backend)

Railway detects the `Dockerfile` at the root automatically via `railway.toml`.

**Setup:**
1. New Project → Deploy from GitHub repo → select this repo
2. Add environment variables in the Railway dashboard:

```
DATABASE_URL          = postgresql://...
JWT_SECRET            = ...
JWT_REFRESH_SECRET    = ...
FRONTEND_ORIGIN       = https://your-app.vercel.app
```

Railway injects `PORT` automatically — the app reads it via `process.env.PORT`.

Every push to `main` triggers an automatic redeploy.

### Neon (database)

Create a project on [neon.tech](https://neon.tech), copy the connection string, and use it as `DATABASE_URL`. TypeORM synchronizes the schema on startup.
