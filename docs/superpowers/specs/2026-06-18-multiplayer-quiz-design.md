---
name: multiplayer-quiz-design
description: Full design spec for the Kahoot-style multiplayer quiz app
metadata:
  type: project
---

# Multiplayer Quiz App — Design Spec

**Date:** 2026-06-18

## Overview

A Kahoot-style real-time multiplayer quiz application. A host creates quizzes with configurable single/multiple-answer questions and time limits. Participants join via a room code, answer questions in real time, and compete on a speed-based leaderboard.

---

## Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React + Vite | Vercel |
| Backend | NestJS + Socket.IO | Fly.io |
| Database | PostgreSQL | Neon (serverless) |
| ORM | TypeORM | — |
| Monorepo | pnpm workspaces | — |

---

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

---

## Identity & Auth

Two roles with different auth strategies:

**Host** — registers and logs in with email + password. Credentials are stored in the DB (`users` table, bcrypt-hashed password). On login the server issues a short-lived JWT (access token, 15 min) and a long-lived refresh token (httpOnly cookie, 7 days). All quiz and session data belongs to the host's `user.id` via a real FK — quizzes are accessible from any device as long as the host can log in.

Auth endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`.

Protected REST endpoints use a `JwtAuthGuard` (Bearer token in `Authorization` header). The Socket.IO gateway expects `io({ auth: { token: '<jwt>' } })` and validates it before accepting host commands (`session:start`, `session:next`).

**Participant** — no account. Provides `firstName`, `lastName`, and `nickname` when joining. Only `nickname` is displayed in the UI. All three fields are persisted in the DB.

**Participant rejoin:** if a participant closes the app mid-session and returns while the session is still `ACTIVE`, they can rejoin by entering the same room code and the same nickname (match is case-insensitive). The server looks up the existing `Participant` row by `(session_id, LOWER(nickname))`; if found, the socket is reattached to that participant's record and their accumulated score is restored. No re-entry is allowed once the session is `FINISHED`.

---

## Data Models

### User
| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | varchar UNIQUE | |
| password_hash | varchar | bcrypt |
| created_at | timestamp | |

### Quiz
| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| host_id | UUID FK → User | |
| title | varchar | |
| description | text | nullable |
| created_at | timestamp | |

### Question
| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| quiz_id | UUID FK → Quiz | |
| text | text | |
| type | enum | `SINGLE` \| `MULTIPLE` |
| time_limit | int | seconds — options: 5, 10, 20, 30, 60 |
| max_points | int | default 1000 |
| order | int | display order within quiz |

### Answer
| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| question_id | UUID FK → Question | |
| text | varchar | |
| is_correct | boolean | |

### Session
| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| quiz_id | UUID FK → Quiz | |
| host_id | UUID FK → User | creator |
| code | varchar(6) UNIQUE | random alphanumeric, regenerated on collision |
| status | enum | `WAITING` \| `ACTIVE` \| `FINISHED` |
| current_question_idx | int | default -1 (not started) |
| started_at | timestamp | nullable |
| finished_at | timestamp | nullable |
| created_at | timestamp | |

### Participant
| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → Session | |
| first_name | varchar | |
| last_name | varchar | |
| nickname | varchar | shown in UI |
| score | int | cumulative, default 0 |
| joined_at | timestamp | |

### ParticipantAnswer
| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| participant_id | UUID FK → Participant | |
| question_id | UUID FK → Question | |
| answer_ids | jsonb | `UUID[]` of selected Answer ids |
| response_time_ms | int | ms from question start to submission |
| points_earned | int | calculated on server |
| answered_at | timestamp | |

---

## Scoring

```
points_earned = round(max_points × max(0.5, 1 − response_time_ms / time_limit_ms))
```

| Scenario | Points |
|---|---|
| Correct + instant | `max_points` |
| Correct + at time limit | `max_points × 0.5` |
| Incorrect | 0 |
| No answer (timeout) | 0 |

**MULTIPLE type rule:** the participant must select all correct answers and no incorrect ones. Any deviation (missing a correct answer or including a wrong one) results in 0 points — no partial credit.

---

## Session State Machine

```
WAITING
  └─▶ ACTIVE (host clicks Start)
        └─▶ QUESTION_OPEN (server emits question:start)
              └─▶ QUESTION_CLOSED (timer expires OR host ends manually)
                    └─▶ LEADERBOARD (server emits leaderboard:update)
                          ├─▶ QUESTION_OPEN (host clicks Next — repeats for each question)
                          └─▶ FINISHED (no more questions — server emits session:finished)
```

The server owns the timer. When `time_limit` expires, the server transitions to `QUESTION_CLOSED` automatically — participants who haven't answered yet get 0 points. The host can also trigger an early end via `session:next`.

---

## Socket.IO Events

Rooms: every session uses a Socket.IO room keyed by `session.code`. All clients (host + participants) join the same room.

### Client → Server

| Event | Payload | Emitter |
|---|---|---|
| `session:join` | `{ code, firstName, lastName, nickname }` | Participant |
| `session:start` | `{ sessionId }` | Host |
| `session:next` | `{ sessionId }` | Host (advances to next question or ends session) |
| `answer:submit` | `{ questionId, answerIds: string[] }` | Participant |

### Server → Client(s)

| Event | Payload | Recipients |
|---|---|---|
| `player:joined` | `{ nickname, totalPlayers }` | All in room |
| `question:start` | `{ questionId, text, type, answers: [{id, text}], timeLimitMs, maxPoints, questionIndex, totalQuestions }` | All |
| `question:tick` | `{ remainingMs }` | All |
| `question:end` | `{ correctAnswerIds: string[] }` | All in room (broadcast) |
| `answer:result` | `{ correct: boolean, pointsEarned: number, newScore: number }` | Individual socket only |
| `leaderboard:update` | `{ rankings: [{rank, nickname, score, delta}] }` | All |
| `session:finished` | `{ finalRankings: [{rank, nickname, score}] }` | All |
| `error` | `{ message }` | Emitter only |

**Security:** `is_correct` is never sent during `QUESTION_OPEN`. Correct answers are only revealed via `question:end` after the question closes. `answer:result` is emitted individually per socket so no participant sees another's score delta before the leaderboard.

**Host identification on socket:** The host connects with `io({ auth: { token: '<jwt>' } })`. The gateway reads `socket.handshake.auth.token`, validates the JWT, and uses the decoded `userId` to verify host ownership before processing `session:start` and `session:next`. Participants connect without auth.

**Participant rejoin on socket:** When `session:join` arrives with a nickname that matches an existing participant in the session (case-insensitive), the gateway reattaches the socket to that participant row, restores their score, and emits `player:rejoined` (same payload as `player:joined` but with `{ rejoined: true, score }`). If the session is `FINISHED`, `session:join` returns an `error` event instead.

**In-memory vs DB session state:** `Session.status` in Postgres only tracks `WAITING | ACTIVE | FINISHED`. The finer states `QUESTION_OPEN`, `QUESTION_CLOSED`, and `LEADERBOARD` are managed in-memory inside `QuizGateway` (a plain `Map<sessionCode, GatewaySessionState>`) and are not persisted.

---

## REST API

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | `{ email, password }` → `{ accessToken }` + sets refresh cookie |
| POST | `/auth/login` | `{ email, password }` → `{ accessToken }` + sets refresh cookie |
| POST | `/auth/refresh` | Reads refresh cookie → `{ accessToken }` |
| POST | `/auth/logout` | Clears refresh cookie |

### Quizzes (JWT protected)

| Method | Path | Description |
|---|---|---|
| GET | `/quizzes` | List all quizzes for the authenticated host |
| POST | `/quizzes` | Create quiz `{ title, description? }` |
| GET | `/quizzes/:id` | Get quiz with questions and answers |
| PUT | `/quizzes/:id` | Update title or description |
| DELETE | `/quizzes/:id` | Delete quiz and cascade |

### Questions

| Method | Path | Description |
|---|---|---|
| POST | `/quizzes/:id/questions` | Add question |
| PUT | `/questions/:id` | Update question fields |
| DELETE | `/questions/:id` | Delete question |

### Answers

| Method | Path | Description |
|---|---|---|
| POST | `/questions/:id/answers` | Add answer |
| PUT | `/answers/:id` | Update answer text or is_correct |
| DELETE | `/answers/:id` | Delete answer |

### Sessions

| Method | Path | Description |
|---|---|---|
| POST | `/sessions` | JWT protected. Create session `{ quizId }` → `{ code, sessionId }` |
| GET | `/sessions/:code` | Get session status and participant list (public) |

---

## NestJS Modules

| Module | Responsibility |
|---|---|
| `AuthModule` | Register/login, JWT signing/validation, refresh token cookie |
| `QuizzesModule` | REST CRUD for Quiz, Question, Answer entities (JWT protected) |
| `SessionsModule` | Session creation, code generation (6-char, collision-safe) |
| `QuizGateway` | Socket.IO gateway — session lifecycle, timer management, answer handling, participant rejoin |
| `ScoringService` | Points calculation, leaderboard ranking |
| `DatabaseModule` | TypeORM connection to Neon, entity registration |

---

## UI Screens

### Host

| Screen | Description |
|---|---|
| Login / Register | Email + password form. On success stores JWT in memory (or `sessionStorage`); refresh token is httpOnly cookie, so handled transparently by the browser. |
| Quiz List | Grid of the authenticated host's quizzes. Button to create new. |
| Quiz Editor | Sidebar with question list (reorderable) + right-side editor. Each question: text, type toggle (SINGLE/MULTIPLE), time limit select (5/10/20/30/60s), max_points, answers list with is_correct toggle. |
| Session Lobby | Large monospace room code, live participant chips, "Start" button (disabled until ≥1 participant). |
| Question Control | Current question display, countdown timer, "X of N answered" counter, manual "End question" button. |
| Partial Leaderboard | Rankings after each question, "Next question" button. |
| Final Leaderboard | Full rankings, "End session" button. |

### Participant

| Screen | Description |
|---|---|
| Join | Code input (auto-uppercase), firstName, lastName, nickname. |
| Waiting Room | Confirmation of nickname + "Waiting for host…" |
| Question | Colored answer buttons. SINGLE: tap selects one (others dim to 35% opacity, selected gets white ring + ✓). MULTIPLE: toggle multiple (selected gets ring + ✓, unselected dims) + "Confirm" button. |
| Answer Result | Correct/incorrect indicator + points earned this round. |
| Partial Leaderboard | Current ranking shown after each question ends. |
| Final Leaderboard | Final ranking at end of session. |

---

## Deployment

| Service | Platform | Notes |
|---|---|---|
| Backend | Fly.io | Single shared-cpu-1x instance, free tier |
| Frontend | Vercel | CDN-served, env var for backend URL |
| Database | Neon | Serverless PostgreSQL, free tier (0.5 GB) |

CORS on NestJS allows the Vercel frontend origin. Socket.IO configured with `websocket` as primary transport and `polling` as fallback.

---

## Monorepo Build Strategy

### How `packages/shared` is consumed

`shared` exports TypeScript source directly — no separate build step:

```json
// packages/shared/package.json
{ "name": "@quiz/shared", "main": "./src/index.ts", "types": "./src/index.ts" }
```

Both Vite (frontend) and `tsc` (backend) transpile TS, so they consume the source inline. This eliminates the need to coordinate build order for the shared package.

When `pnpm install` runs from the monorepo root it creates symlinks so workspace packages can resolve each other:

```
packages/backend/node_modules/@quiz/shared  →  ../../shared
packages/frontend/node_modules/@quiz/shared →  ../../shared
```

### Vercel (frontend)

Do **not** set the Vercel project root to `packages/frontend` — that would cut off access to `packages/shared`. Configure from the repo root instead:

| Setting | Value |
|---|---|
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm --filter @quiz/frontend build` |
| Output directory | `packages/frontend/dist` |

Vercel installs from the root (symlinks created), then Vite builds the frontend and transpiles shared inline.

### Fly.io (backend)

The Dockerfile must copy the full monorepo structure so pnpm can link the shared package:

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

---

## Out of Scope (MVP)

- Quiz sharing between hosts
- Images or media in questions/answers
- Participant re-join with a different nickname (progress lost)
- Mobile-native app (responsive web only)
- Analytics or results export
