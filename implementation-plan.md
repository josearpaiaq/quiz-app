# Multiplayer Quiz App — Implementation Plan

## Goal
Scaffold and implement the full app: pnpm monorepo → shared types → NestJS backend → React frontend → deploy config.

## Tasks

- [x] **1. Monorepo scaffold** — root `package.json`, `pnpm-workspace.yaml`, root `tsconfig.json`, `packages/shared` init → `pnpm install` runs clean from root
- [x] **2. Shared package** — const-object enums, entity types, Socket.IO event payload types, DTOs → both FE and BE compile using shared
- [x] **3. Backend scaffold** — NestJS, deps (TypeORM, pg, passport, jwt, socket.io, bcryptjs), `DatabaseModule` with all entities → `nest build` passes
- [x] **4. Auth** — `User` entity, `AuthModule` (register, login, refresh cookie, logout), `JwtAuthGuard` → endpoints exist and guarded
- [x] **5. Quizzes CRUD** — `QuizzesModule` with Quiz/Question/Answer entities and REST endpoints (JWT protected) → full CRUD
- [x] **6. Sessions** — `SessionsModule` (create session, collision-safe 6-char code) → `POST /sessions` returns `{ code, sessionId }`
- [x] **7. Quiz Gateway** — Socket.IO: `session:join` (+ rejoin by nickname), `session:start`, `session:next`, `answer:submit`; server timer, `ScoringService` → gateway built
- [x] **8. Frontend scaffold** — Vite+React, React Router, TanStack Query, socket.io-client, Tailwind → `vite build` passes
- [x] **9. Host UI** — Login/Register, Quiz List, Quiz Editor, Session Lobby, Question Control, Leaderboards → pages built
- [x] **10. Participant UI** — Join screen, Waiting Room, Question screen (SINGLE + MULTIPLE), Answer Result, Leaderboards → pages built
- [x] **11. Deploy config** — `Dockerfile` (Fly.io), `fly.toml`, `vercel.json` → files created

## Done When
- [ ] Host can register, log in, create a quiz with questions, start a session — **needs live DB to test**
- [ ] Participants join via code, play in real time, and see the leaderboard — **needs live test**
- [ ] Participant can close and rejoin with same nickname mid-session — **needs live test**
- [ ] Both Vercel and Fly.io builds pass — **both build locally** ✓
