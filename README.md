# Multiplayer Quiz App

A Kahoot-style real-time multiplayer quiz application. Hosts create and manage quizzes; participants join via a room code and compete on a live leaderboard.

## Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React + Vite | Vercel |
| Backend | NestJS + Socket.IO | Fly.io |
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
├── pnpm-workspace.yaml
└── package.json
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

`packages/shared` exports TypeScript source directly — no separate compile step:

```json
{ "name": "@quiz/shared", "main": "./src/index.ts", "types": "./src/index.ts" }
```

Both Vite and `tsc` transpile TS natively, so they consume `shared` inline without a pre-build. When `pnpm install` runs from the root, pnpm creates symlinks so each package can resolve `@quiz/shared`:

```
packages/backend/node_modules/@quiz/shared  →  ../../shared
packages/frontend/node_modules/@quiz/shared →  ../../shared
```

This means **`pnpm install` must always run from the repo root** — in local dev, CI, and both deployment platforms.

## Deployment

### Vercel (frontend)

Do **not** set the Vercel project root to `packages/frontend` — that would cut off access to `packages/shared`. Configure from the repo root:

| Setting | Value |
|---|---|
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm --filter @quiz/frontend build` |
| Output directory | `packages/frontend/dist` |

Add environment variable `VITE_API_URL` pointing to the Fly.io backend URL.

### Fly.io (backend)

The Dockerfile copies the full monorepo structure so pnpm can link `packages/shared` before building:

```dockerfile
FROM node:20-alpine AS builder
RUN npm i -g pnpm
WORKDIR /app

# Workspace manifests first (maximizes Docker layer cache)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json  ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN pnpm install --frozen-lockfile

# Source
COPY packages/shared  ./packages/shared
COPY packages/backend ./packages/backend

RUN pnpm --filter @quiz/backend build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/node_modules          ./node_modules
CMD ["node", "dist/main.js"]
```

Add the required secrets via `fly secrets set DATABASE_URL=... JWT_SECRET=... JWT_REFRESH_SECRET=... FRONTEND_ORIGIN=...`.

### Neon (database)

Create a project on [neon.tech](https://neon.tech), copy the connection string, and use it as `DATABASE_URL`. TypeORM runs migrations on startup (`synchronize: true` in dev, explicit migrations in production).