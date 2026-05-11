# Virtual Device API — Victron solar yield proxy

Node.js (TypeScript) service that syncs **Victron VRM** `total_solar_yield` into a small API:

- `GET /installations/solar-yield` — persisted **cumulative** and last completed **15‑minute** window  
- `GET /health` — liveness (no dependencies)  
- `GET /ready` — readiness (database `authenticate()`)  
- `GET /api-docs` — Swagger UI  

## Behaviour (short)

1. **Scheduler** — On startup, runs catch-up (optional, see `TRACKING_START_UTC`), then polls every **15 minutes** (UTC boundaries + a few seconds offset for VRM).
2. **Persistence** — **Postgres** when `DATABASE_URL` is set; otherwise **SQLite** under `data/solar-yield.sqlite`. Legacy `data/solar-yield.json` is migrated once on boot if present.
3. **VRM** — Uses `interval=15mins` for live polls; catch-up can use `interval=days` or `months` via `CATCHUP_VRM_INTERVAL`. HTTP calls use **timeouts and retries** (see `.env.example`).

## Production checklist

| Topic | What to do |
|--------|----------------|
| **Env** | Copy `.env.example` → `.env` / platform secrets. In `NODE_ENV=production`, **VICTRON_API_URL**, **VICTRON_API_TOKEN**, and **VICTRON_SITE_ID** are required at boot. |
| **Database** | Set **DATABASE_URL** (managed Postgres). Tune **DB_POOL_*** if needed. |
| **Observability** | JSON logs in production; set **LOG_LEVEL**. Optionally **LOG_TO_FILE=1** if the filesystem is writable. |
| **Ingress** | Set **PUBLIC_API_URL** so Swagger shows the correct server URL. If behind a reverse proxy, set **TRUST_PROXY=1**. |
| **Probes** | Map load balancer health to **`/health`**; readiness to **`/ready`** (checks DB). |
| **Shutdown** | Process handles **SIGTERM** / **SIGINT**: stops the scheduler, closes HTTP, closes DB pool (Render/Kubernetes friendly). |
| **Secrets** | Never commit tokens; rotate if leaked. |
| **Ops scripts** | `npm run catchup`, `catchup:fresh`, `reconcile`, `rebuild:daily` are **destructive** or heavy — require explicit `CONFIRM_*` env vars where documented. |

## Environment variables

See **`.env.example`** for the full list (Victron, DB pool, VRM timeouts, logging, optional backfill).

## Local development

```bash
npm install
npm run dev
```

## Build & run

```bash
npm run build
npm start
```

## CI

GitHub Actions workflow **`.github/workflows/ci.yml`** runs `npm ci`, **`npm run build`**, and **`npm test`**.

## Tests

```bash
npm test
```

**Vitest** runs tests under **`tests/`** against modules in `src/domain/` (odometer delta, history overlap, 15‑minute UTC boundaries).

## Database migrations

**Umzug** runs migrations from `src/persistence/migrations/` on startup (see `SequelizeMeta`). The initial migration creates **`sites`** only if missing (safe for DBs that previously used `sequelize.sync()`). Use **`SKIP_DB_MIGRATIONS=1`** only for local emergencies (falls back to `sync()`). **`UMZUG_LOG=1`** enables migration console output.

## Scheduler observability

Winston logs **`scheduler.audit`** with events such as `scheduler_startup_catchup`, `scheduler_scheduled_fetch`, `scheduler_skip_concurrent`, and `scheduler_timers_armed`, including **`durationMs`**, **`kwh`**, and interval bounds when relevant (useful for metrics from JSON logs).

## Source layout

| Path | Role |
|------|------|
| `src/app.ts` | HTTP server bootstrap, lifecycle, routes wiring |
| `src/config/` | Env-backed configuration and production validation |
| `src/common/logging/` | Shared Winston logger |
| `src/http/` | Express controller + error middleware (`*.controller.ts`, `*.middleware.ts`) |
| `src/api/openapi/` | Swagger / OpenAPI setup |
| `src/persistence/` | Sequelize site store, **Umzug migrations** (`site-store.ts`, `migrations/`) |
| `src/domain/` | Pure solar interval + odometer math (unit-tested) |
| `src/integrations/victron/` | VRM HTTP client + auth header helper (DRY) |
| `src/services/` | Orchestration: scheduler, catch-up, reconcile |
| `tests/` | Vitest specs (import from `src/`) |
| `scripts/` | Ops entrypoints (Node); load `.env` from repo root |

Naming: **`kebab-case` for middleware/setup files**, **`thing.controller.ts`** for HTTP handlers, **`thing-store.ts`** for persistence.

## Operational scripts (`scripts/`)

| npm script | Purpose |
|------------|---------|
| `npm run catchup` | Fill gaps from `TRACKING_START_UTC` through last completed 15m slot. |
| `CONFIRM_RESET_SITE=1 npm run catchup:fresh` | **Wipe** site row, then catch-up. |
| `npm run reconcile` | Compare DB sum vs VRM for the stored history range. |
| `CONFIRM_REBUILD_DAILY=1 npm run rebuild:daily` | **Destructive**: replace history with daily VRM rebuild. |

## API example

```bash
curl -s http://localhost:3000/installations/solar-yield | jq .
```

## Limits / notes

- VRM stats ranges depend on `interval` (see Victron docs). Catch-up uses **days** or **months** to avoid huge `15mins` spans.
- `total_solar_yield` is an **odometer**; production in each interval uses **last − first** (and `totals` when present). Noisy series or resets can make “sum of history” differ from a naive reconciliation — see `reconcile` output.
- **Migrations** apply versioned DDL via Umzug; add new files under `src/persistence/migrations/` for schema changes.

## Security

Keep **VICTRON_API_TOKEN** and **DATABASE_URL** private. Do not enable **VRM_DEBUG=1** in production (logs full VRM payloads).
