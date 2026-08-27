# Free Frees

A web-first generic card game platform. Game definitions are declared as schema-validated data, compiled into typed engine definitions, and executed by an authoritative server.

## Stack choices

- Fastify for the HTTP API because it has a small core, strong TypeScript ergonomics, and good plugin support.
- Socket.IO for realtime rooms because reconnects, room broadcasts, and browser compatibility are built in.
- Zod for request and game-definition validation so schemas and TypeScript types stay close.
- Prisma with SQLite for local-first persistence.
- HTTP-only signed session cookies, backed by a `Session` table, instead of localStorage JWTs.

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

Web: http://localhost:5173
API: http://localhost:3000

SQLite data is stored in `prisma/dev.db` when using the default `DATABASE_URL`.

## Packages

- `apps/web`: React, Vite, Tailwind, lobby and game screens.
- `apps/server`: Fastify API, Socket.IO room updates, auth/session handling.
- `packages/engine`: declarative definitions, compiler boundary, Klondike and Go Fish runtimes, bots.
- `packages/shared`: shared IDs, schemas, API DTOs, room state types.

## Game definition files

Game metadata lives in `packages/engine/definitions/*.json`. A definition declares decks, zones, setup primitives, turn phases, actions, legal checks, effects, scoring, end conditions, visibility, and bot strategy.

The current language version is `0.1`. Dropping a schema-valid JSON file into that directory makes it appear in the game list after restart. Playability still requires an implemented runtime binding in `engine.runtime`; today those bindings are `klondike` and `go-fish`.
