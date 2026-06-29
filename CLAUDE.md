# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install (always from repo root — creates workspace symlinks)
pnpm install

# Dev (run in separate terminals)
pnpm dev:backend    # builds @quiz/shared first, then starts NestJS with --watch
pnpm dev:frontend   # Vite dev server

# Build
pnpm build:shared
pnpm build:backend
pnpm build:frontend

# Test (backend)
cd packages/backend && pnpm test               # unit tests
cd packages/backend && pnpm test:e2e           # e2e tests
cd packages/backend && pnpm test -- --testPathPattern=auth  # single file

# Lint (backend)
cd packages/backend && pnpm lint
```

`@quiz/shared` must be compiled to `dist/` before either consumer builds or type-checks. When in doubt, run `pnpm build:shared` first.

## Architecture

### Packages

- **`packages/shared`** — TypeScript-only, no runtime deps. Exports: entity interfaces (`entities.ts`), `SessionStatus`/`QuestionType` const enums (`enums.ts`), Socket.IO payload types and `SOCKET_EVENTS` constants (`socket-events.ts`), and REST DTOs (`dtos.ts`). Both backend and frontend import from `@quiz/shared`.

- **`packages/backend`** — NestJS app. Modules:
  - `auth` — register/login/refresh/logout; JWT access token (short-lived) + refresh token in `httpOnly` cookie; `JwtAuthGuard` protects REST routes.
  - `quizzes` — CRUD for quizzes, questions, and answers (REST, JWT-protected).
  - `sessions` — creates a session for a quiz and returns its room code (REST).
  - `gateway` — the single `QuizGateway` (Socket.IO) drives all real-time gameplay. It holds an in-memory `Map<code, GatewaySessionState>` that tracks phase, current question index, tick interval, per-socket scores, and answered socket IDs. This state is lost on server restart; it is not persisted to the DB mid-game.
  - `database` — TypeORM entities, `DatabaseModule` (single datasource, `synchronize: true`).

- **`packages/frontend`** — React 19 + Vite + TailwindCSS v4 + DaisyUI. Two user flows:
  - **Host** (`/host/*`) — authenticated; pages for login, quiz list, quiz editor, session lobby, and session control.
  - **Participant** (`/`, `/session/:code`) — unauthenticated; join by room code and play.
  - `lib/api.ts` — Axios/fetch wrapper for REST calls.
  - `lib/socket.ts` — singleton Socket.IO client. Emits are guarded against React StrictMode double-invocation; rejoins all active sessions on reconnect.
  - `hooks/useAuth.ts` — reads/writes `access_token` from `sessionStorage`.

### Real-time game flow

```
Host emits SESSION_START → gateway advances to question_open phase
  → broadcasts QUESTION_START to room
  → setInterval ticks QUESTION_TICK every 1 s
  → on timeout (or host emits SESSION_NEXT) → closeQuestion()
      → broadcasts QUESTION_END (correct answer IDs)
      → broadcasts LEADERBOARD_UPDATE
      → phase = leaderboard
  → host emits SESSION_NEXT again → advanceToNextQuestion()
  → when all questions done → SESSION_FINISHED
```

Participants emit `ANSWER_SUBMIT`; the gateway scores it via `ScoringService`, saves a `ParticipantAnswer` row, and sends `ANSWER_RESULT` back to that socket only. It also sends `ANSWER_COUNT_UPDATE` to the host socket.

### Auth flow

- REST login returns `{ accessToken, user }` and sets a `refresh_token` `httpOnly` cookie.
- Frontend stores `accessToken` in `sessionStorage` and passes it as `Authorization: Bearer …` on REST calls and as `socket.handshake.auth.token` for the WebSocket connection.
- `POST /auth/refresh` rotates both tokens using the cookie.

### Data model (TypeORM entities)

`User → Quiz → Question → Answer` (ownership chain). A `Session` links a `Quiz` to a live room (unique `code`). `Participant` belongs to a `Session`; `ParticipantAnswer` records each answer with points earned.

## Environment variables

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
