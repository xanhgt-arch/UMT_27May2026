# UMT2 Backend Plan — Node.js

Backend plan for the UMT2 dashboard. The existing SQL Server database
(test + production) is **read-only** from this service's perspective —
we do not alter its schema, write to it, or run migrations against it.
The backend's job is to read raw data, preprocess and aggregate it in
the application layer, cache the results, and serve them to the React
dashboard.

---

## 1. Architecture at a glance

```
        [Existing SQL Server]
        ├─ UMT_TEST  (read-only access)
        └─ UMT_PROD  (read-only access)
                │
                │  parameterized SELECTs only
                ▼
        ┌──────────────────────────────────────┐
        │  Node.js backend (this service)      │
        │                                      │
        │  ┌────────────┐   ┌──────────────┐   │
        │  │  Query     │ → │ Preprocessor │   │
        │  │  layer     │   │ (pure fns)   │   │
        │  └────────────┘   └──────────────┘   │
        │         │                │           │
        │         ▼                ▼           │
        │  ┌────────────┐   ┌──────────────┐   │
        │  │ Aggregator │ → │ Response DTO │   │
        │  └────────────┘   └──────────────┘   │
        │         │                            │
        │         ▼                            │
        │  ┌────────────┐                      │
        │  │ Redis cache│  (results + warm)    │
        │  └────────────┘                      │
        └──────────────────────────────────────┘
                │
                │  REST + JSON
                ▼
        [React dashboard (existing)]
```

Two key consequences of "read-only DB":

1. **All preprocessing happens in the Node service**, not the database. Whatever shape the existing tables have, we cope with it in code.
2. **Heavy work is amortized by caching**, not by pre-computed aggregate tables. Redis is the moral equivalent of "materialized views" but lives outside the DB.

---

## 2. Tech stack

| Layer | Pick | Why |
|---|---|---|
| Runtime | **Node.js 22 LTS** | LTS through Apr 2027; native fetch, test runner, built-in watch mode |
| Language | **TypeScript 5.5+ (strict mode)** | Type-safe DTOs shared with the React frontend via a workspace package |
| Framework | **NestJS 10** | Modules, dependency injection, decorators, guards, interceptors — clean shape for a multi-endpoint analytics API |
| DB driver | **`mssql` (tedious under the hood)** | Battle-tested SQL Server client, supports MARS, connection pools, streaming queries |
| Query layer | **Raw parameterized SQL via `mssql`** | No ORM in the read path — every chart endpoint owns a focused SQL statement |
| Validation | **Zod** | Schema-validates query params, response shapes, and env config |
| Cache | **Redis (`ioredis`)** | Per-endpoint result cache, snapshot pointer, rate-limit counters |
| Background jobs | **BullMQ** | Cache warmer, scheduled aggregations, cleanup tasks |
| Scheduler | **`@nestjs/schedule`** triggers BullMQ jobs | In-process cron; BullMQ handles retries, concurrency, and dead-letter queues |
| Auth | **`@nestjs/passport` + `passport-azure-ad` (OIDC) + `passport-jwt`** | Entra ID / Azure AD SSO; JWT bearer on every API call |
| Logging | **Pino + `nestjs-pino`** with OpenTelemetry exporter | Structured JSON; correlation IDs propagated via AsyncLocalStorage |
| Metrics/Trace | **OpenTelemetry SDK for Node** | Auto-instrumentation for HTTP, `mssql`, `ioredis`, BullMQ |
| Tests | **Vitest** + **Testcontainers for Node** (SQL Server 2022) + **Supertest** | Real DB in CI; HTTP + contract tests |
| Build | **`tsc` + `tsup`** (or NestJS's built-in `webpack`) | Single bundled output per app |
| Container | **Node 22 distroless** | Small attack surface, non-root |

---

## 3. Database access strategy

### 3.1 Read-only credentials

The Node service connects with a **dedicated read-only SQL login** scoped to the specific schema/tables the dashboard needs. The DBA team grants `db_datareader` (or a custom role with only `SELECT` on the relevant tables). No `INSERT`, `UPDATE`, `DELETE`, `EXECUTE`, or DDL grants — defence in depth even if app code is compromised.

Connection strings live in **Azure Key Vault** (or the equivalent secret store). The service refuses to start if a required secret is missing.

```ts
// pseudo-config
DB_TEST_USER = "umt2_readonly"      // read-only login
DB_PROD_USER = "umt2_readonly"      // read-only login
DB_TEST_HOST = "..."
DB_PROD_HOST = "..."
DB_POOL_MIN = 2
DB_POOL_MAX = 20
DB_QUERY_TIMEOUT_MS = 30000
```

### 3.2 Read replica preferred

If a read replica or AlwaysOn secondary is available, point the service at it. Reasons:

- Analytics queries can scan large date ranges and would otherwise compete with OLTP writes.
- A replica isolates the dashboard from production write traffic — if a query goes sideways, it cannot affect the producer apps.

If no replica exists, talk to the DBA team about `READ_COMMITTED_SNAPSHOT` or use `WITH (NOLOCK)` very deliberately (only when the small risk of dirty reads is acceptable for the chart in question — usually fine for aggregates that get recomputed every 15 min anyway).

### 3.3 Two environments, two connection pools

```
test environment of this backend  →  UMT_TEST  (read-only)
prod environment of this backend  →  UMT_PROD  (read-only)
local dev                          →  UMT_TEST  with reduced row scope,
                                      OR a sanitized SQLite/MSSQL container
                                      seeded with 90 days of anonymized data
```

Each environment gets its own pool. No cross-environment routing.

### 3.4 Connection pooling

`mssql` pool tuned per environment:

```ts
{
  pool: { min: 2, max: 20, idleTimeoutMillis: 30000 },
  options: {
    encrypt: true,
    enableArithAbort: true,
    trustServerCertificate: false,
  },
  requestTimeout: 30_000,
  connectionTimeout: 15_000,
}
```

Long-running analytic queries are gated by `requestTimeout` so a runaway query cannot starve the pool.

---

## 4. Data-handling pipeline (per request, or per warmer run)

```
[query]  →  [stream rows]  →  [preprocess]  →  [aggregate]  →  [shape DTO]  →  [cache]  →  [respond]
```

Each step in detail:

### 4.1 Query

Per-endpoint hand-written SQL, parameterized. Each chart owns one focused statement that returns the smallest row set that's still useful to the preprocessor. Examples:

- `monthly-cad` returns one row per (month, CAD) bucket already grouped by SQL.
- `region-monthly` returns one row per (month, region) — also grouped by SQL.
- `sessions` returns raw session rows (paginated cursor).
- Any chart needing custom buckets that the existing schema doesn't express cleanly returns a wider row set and groups in JS.

Rule of thumb: **push as much filtering and grouping into SQL as the existing indexes support**. Anything the indexes can't accelerate, do in Node. Profile first, micro-optimize only when an endpoint exceeds the 200ms target.

### 4.2 Stream rows (for wide result sets)

For endpoints that may return tens of thousands of rows (the `/sessions` table page, or a backfilled cache warmer), use `mssql`'s streaming mode (`request.stream = true`) so the row reader is back-pressure correct and the heap never holds the whole result set.

### 4.3 Preprocess — pure, deterministic, unit-testable

Each raw row goes through a chain of pure functions in `src/preprocess/`. Every step is independently unit-testable and idempotent.

1. **Schema sanity** — required columns present, types as expected. A row that fails sanity is dropped and counted in a `rowsRejected` metric so we can alert if the percentage spikes (signals an upstream schema change).
2. **Timezone normalization** — every timestamp is treated as UTC at the boundary; display-time conversions happen on the frontend.
3. **Trim & casefold** — strings trimmed; CAD names, region codes, status codes uppercased; application names normalized through an in-memory alias map so "NX12", "NX 12", "Siemens NX" collapse to "NX".
4. **Null / unknown handling** — categorical nulls map to an explicit `UNKNOWN` bucket so chart slots stay stable, rather than silently dropping rows.
5. **Outlier flagging** — sessions with non-positive or absurd durations (`<= 0` or `> 24h`) get a `quality_flag = false`. They are excluded from KPI rollups but visible in the raw `/sessions` endpoint so analysts can debug.
6. **De-duplication** — a content hash (`SHA-256` of the natural key columns) is computed and used to drop dupes that occasionally appear when the producer retried.
7. **Bot / synthetic filter** — known QA accounts and load-test workstation names map to `is_synthetic = true`. The default chart endpoints exclude these; an opt-in query param `?includeSynthetic=true` (admin-only) shows them.
8. **Activity bucket derivation** — raw action codes from the existing schema are mapped to the four dashboard buckets (validation / execution / block creation / viewing) via a versioned in-code map (`activityMap.v1.ts`). If the mapping changes, we bump the version and invalidate the cache.
9. **Fluids/Sealings classification** — derived from product line + application via a similarly versioned rules map.
10. **Region inference** — if a session row lacks `region`, infer from a user-to-region map loaded at boot. If still unknown, bucket to `UNKNOWN`.
11. **PII shielding** — usernames returned by the API are hashed (HMAC with a rotating key from Key Vault). The raw username is never sent to the frontend. A separate admin endpoint can resolve a hashed username back to a real one for users with the `admin` role.

### 4.4 Aggregate (when SQL didn't already do it)

If the SQL step returned grouped rows, this stage just shapes them. If it returned raw rows, the aggregator walks them once with a `Map` keyed by the dimension(s) needed for the chart. Pure functions, easy to test.

### 4.5 Shape into DTO

The result is shaped into the exact JSON envelope the frontend expects (see Section 6.4). Zod validates the envelope before it leaves the service — if a future code change accidentally returns the wrong shape, the test suite or runtime guard catches it.

### 4.6 Cache

Result keyed by `sha256(endpoint + sorted filter JSON + snapshotId)` (see Section 7). TTL aligned with the cache warmer cadence so hot keys are nearly always warm.

### 4.7 Respond

Standard envelope (Section 6.4) with `meta.fromCache` flag for observability.

---

## 5. Cache warmer (background jobs)

The dashboard has a small set of "hot" filter combinations — no filters at all, single CAD filter, single region filter, "last 12 months" range. Warming these in the background keeps the user-facing latency at ~Redis-read time (single-digit ms) for the common case.

| Job | Cadence | Notes |
|---|---|---|
| Warm KPI strip | every 15 min | Single payload, no filters, used by Home page |
| Warm "no-filter" chart payloads | every 15 min | Every chart endpoint, default filters |
| Warm common single-dim filters | every 30 min | Per-region, per-CAD, per-product-line slices |
| Sliding 7-day re-aggregate | every 15 min | Picks up late-arriving rows in the OLTP DB |
| Full overnight refresh | 02:00 UTC | Bumps `snapshotId`, invalidates every cache key, re-warms hot keys |
| Retention cleanup of Redis keys | 03:00 UTC | Drops keys older than 24h that are no longer hot |
| Activity-map / rules-map reload | every 30 min | Re-reads the in-memory classification maps from a version-controlled config |

Implementation: **BullMQ** for retry + DLQ + concurrency control, scheduled by **`@nestjs/schedule`**. Bull Board UI at `/admin/jobs` (admin-only).

The cache warmer runs in a **separate Node process** (`apps/worker`) so heavy SQL queries never compete with API event-loop time. The API process stays lean and responsive.

---

## 6. API design

### 6.1 Endpoint catalogue (v1)

```
GET  /api/v1/kpis?...filters                  → home KPI strip
GET  /api/v1/charts/monthly-cad?...           → MonthlyUsageTotal
GET  /api/v1/charts/application-usage?...     → ApplicationBars / ApplicationDonut
GET  /api/v1/charts/cad-share?...             → CadBars (pie)
GET  /api/v1/charts/region-cad?...            → RegionBars (stacked CATIA/NX)
GET  /api/v1/charts/region-monthly?...        → RegionMonthly
GET  /api/v1/charts/heatmap-year?...          → YearHeatmap
GET  /api/v1/charts/heatmap-monthly?...       → MonthlyHeatmap
GET  /api/v1/charts/app-compare?...           → AppCompare
GET  /api/v1/charts/fluids-sealings?...       → FluidsSealingsSplit
GET  /api/v1/charts/product-line?...
GET  /api/v1/charts/hardware?...
GET  /api/v1/charts/domain?...
GET  /api/v1/sessions?...                     → paginated raw sessions for VdiUsers / Sessions pages
GET  /api/v1/filters/options                  → dropdown values (regions, CADs, …)
GET  /api/v1/health                           → liveness / readiness
GET  /api/v1/version                          → build SHA + current snapshotId
```

### 6.2 Filter contract

Single shared query-string schema across every chart endpoint, validated by Zod:

```
?from=2024-01-01&to=2026-05-19
&cad=CATIA,NX
&region=NA,EU
&productLine=...
&domain=...
&hardware=...
&application=...
&status=success
&includeSynthetic=false
```

Server-side rules:
- `from <= to <= today`
- range span ≤ 5 years
- enum values must exist in the corresponding lookup
- invalid input → 400 with field-level details

This mirrors the `FilterDim[]` definitions already used on the frontend.

### 6.3 Pagination

Only `/sessions` returns a large list. Cursor pagination (`?cursor=<opaque>&limit=200`), max limit 1000. For very large pulls, support `Accept: application/x-ndjson` to stream rows.

### 6.4 Response envelope

```jsonc
{
  "data": [...],
  "meta": {
    "filters": { /* echo of normalized filters */ },
    "snapshotId": "2026-05-19T02:30:00Z",
    "rowCount": 12,
    "fromCache": true
  },
  "error": null
}
```

### 6.5 Versioning

URL-prefixed `/v1` so breaking changes don't require synchronous frontend deploys.

### 6.6 NestJS structure

- One **module per chart family** (`KpisModule`, `MonthlyCadModule`, …). Each owns: a controller, a service, a Zod DTO, and a SQL statement.
- **Global `ValidationPipe`** with `whitelist: true, forbidNonWhitelisted: true` — unknown params return 400.
- **`SnapshotInterceptor`** stamps `meta.snapshotId` from Redis on every response.
- **`CacheInterceptor`** wraps controllers; key = `sha256(endpoint + sorted filter JSON + snapshotId)`, TTL 15 min.
- **OpenAPI** auto-generated by `@nestjs/swagger`; the spec exports as `openapi.json` at build time and is consumed by the frontend's `@umt/contracts` package via `openapi-typescript`.

---

## 7. Caching

Three concentric layers:

1. **Redis result cache** — key = `sha256(endpoint + sorted filter JSON + snapshotId)`, TTL 15 min for chart endpoints, 1 hour for KPI strip. Warmed by the cache-warmer jobs.
2. **`snapshotId` pointer** — a single Redis key (`umt:snapshot`) holding the timestamp of the latest "full refresh" cycle. Every cached response embeds this value. The nightly full refresh bumps `snapshotId` and effectively invalidates every cached payload at once.
3. **HTTP response headers** — `Cache-Control: private, max-age=60, stale-while-revalidate=300` lets the browser dedupe rapid filter toggles without overloading the API.

Cache miss handling: the request runs the full pipeline (Section 4), stores the result, and responds. No cache stampede guarding needed for the chart endpoints in v1 — at the expected RPS, a few simultaneous miss-fills are fine. If we see thundering herd later, add a per-key mutex via `redlock`.

---

## 8. Auth, authz, security

- **AuthN:** Azure AD / Entra ID OIDC, Authorization Code + PKCE. JWT bearer required on every API call. JWT verified against Entra ID's JWKS endpoint.
- **AuthZ:** Two roles for v1:
  - `viewer` — all chart and KPI GETs
  - `admin` — `viewer` + `/admin/jobs` (Bull Board) + the username-de-hash endpoint + cache-flush controls
  Roles resolved from an AD group claim.
- **Optional region scoping** — if a region lead should only see their region's data, a `region_scope` claim is injected into every SQL `WHERE` clause server-side.
- **CORS** — `enableCors({ origin: [DASHBOARD_ORIGIN], credentials: true })`. Allowlist only.
- **Rate limiting** — `@nestjs/throttler` at 60 req/min/user; lower on admin endpoints.
- **Security headers** — `helmet` middleware: HSTS, strict CSP, X-Content-Type-Options, X-Frame-Options DENY.
- **Parameterized SQL only** — `mssql`'s `request.input(name, type, value)`. An ESLint rule blocks template-string SQL across the repo.
- **HMAC for usernames** — `crypto.createHmac('sha256', key)`. Key in Key Vault, rotated every 90 days; keep the previous key live during rotation so existing hashes stay verifiable.
- **Secrets** — `@azure/keyvault-secrets` SDK. Secrets pulled at startup, refreshed every 30 min. No `.env` in the container image.
- **Audit log** — an `@Audit()` decorator-driven interceptor writes admin actions to a separate write-allowed `audit` table or a managed log sink (preferred, since we're keeping the existing DB read-only). Captures actor, action, target, IP, correlation ID.
- **CI gates** — `npm audit` and Snyk; fail the build on high CVEs. OWASP ZAP automated scan against the test environment.
- **Container** — distroless base, non-root user, `npm ci --omit=dev`, no shells available at runtime.

---

## 9. Environments and config

```
local      → dev DB (test mirror in Docker, or read-only test creds with 90-day filter),
             no SSO (dev token), Redis in docker-compose
test       → UMT_TEST read-only, Entra ID test tenant
prod       → UMT_PROD read-only, Entra ID prod tenant
```

Strict env parity: same code, same image, different config. Only connection strings, log levels, and feature flags differ.

`config.ts` validates every env var via Zod at boot — missing/invalid envs crash startup with a clear message (no silent defaults).

---

## 10. Deployment & infra

- **Hosting:** Azure App Service for Containers (Linux) **or** Azure Container Apps. Two container images: `umt-api` and `umt-worker`.
  - `umt-api` — NestJS HTTP service, multiple instances behind the platform load balancer
  - `umt-worker` — NestJS app with no HTTP listener, runs BullMQ consumers and cron
- **Slots:** API has a staging slot; swap into prod for blue/green. Workers deploy via rolling restart — BullMQ retries handle in-flight jobs.
- **Image:** multi-stage Dockerfile — `node:22-alpine` build → `gcr.io/distroless/nodejs22-debian12` runtime. Non-root user, read-only filesystem where supported.
- **CI:** GitHub Actions
  - `lint-test`: ESLint, `tsc --noEmit`, Vitest unit, Vitest integration (Testcontainers spins up SQL Server 2022 with a seeded snapshot of the real schema)
  - `build`: build both images, tag with commit SHA, push to ACR
  - `deploy-test`: on merge to `main`, deploy both images to test, run smoke + contract tests
  - `deploy-prod`: manual approval gate
- **Migrations:** **none against the existing DB.** Any small write-side helper tables (e.g. `audit`) live in a separate dedicated database owned by this service, with their own migrations under our control.
- **Bull Board:** mounted at `/admin/jobs`, guarded by `RolesGuard('admin')`.
- **Health endpoints:**
  - `/health/live` — process up, event loop responsive (< 200 ms ping)
  - `/health/ready` — DB SELECT 1 + Redis PING + last successful warmer run within 2× expected interval

---

## 11. Observability

- **Logs:** Pino → stdout → App Service log stream → Application Insights (or Seq). JSON only. Every log line carries a correlation ID via AsyncLocalStorage.
- **Metrics:** OpenTelemetry SDK auto-instruments `http`, `mssql`, `ioredis`, `bullmq`. Custom counters/gauges:
  - `umt.api.request_ms` (histogram, per endpoint, p50/p95/p99)
  - `umt.cache.hit_ratio` (per endpoint)
  - `umt.preprocess.rows_in` / `umt.preprocess.rows_rejected`
  - `umt.warmer.duration_ms`, `umt.warmer.rows_scanned`
  - `umt.event_loop_lag_p95` (Node-specific)
- **Traces:** OTel exporter → Azure Monitor. End-to-end span: HTTP request → service → SQL query → preprocess → cache write → response.
- **Alerts:**
  - p95 chart-endpoint latency > 800 ms for 5 min
  - Cache hit ratio for warmed endpoints < 80% for 15 min
  - Cache warmer hasn't run successfully in > 2× expected interval
  - Rejected-row ratio > 1% in a warmer cycle (schema-drift signal)
  - 5xx ratio > 1%
  - Unhandled promise rejection count > 0
  - Worker queue depth > 1000
  - DB connection pool exhausted (acquire timeouts > 0)
  - Event-loop lag p95 > 100 ms for 5 min

---

## 12. Testing

| Type | Tooling | Notes |
|---|---|---|
| Unit (preprocessing, mapping, classification, utils) | Vitest | Pure functions; high coverage, fast |
| Integration (SQL → preprocess → cache → HTTP) | Vitest + Testcontainers (SQL Server 2022 image) + ioredis-mock | Each endpoint exercised end-to-end against a seeded DB |
| Contract | Supertest + `openapi-response-validator` | Asserts every response matches the OpenAPI schema |
| Performance | k6 scripts | Gate: each chart endpoint p95 < 200 ms over 5 years of seeded data |
| Security | `npm audit`, Snyk, OWASP ZAP in CI | Fail on high CVEs |
| Mutation (optional) | Stryker | For preprocessing rules where correctness is critical |
| Frontend e2e | Playwright against staging API | Validates the full UI flow with real data shapes |

Coverage gate: **80% lines/branches**, enforced in CI by `vitest --coverage`.

---

## 13. Project layout (monorepo, pnpm workspaces)

```
umt2-backend/
  apps/
    api/                       ← NestJS HTTP service
      src/
        modules/
          kpis/
          monthly-cad/
          region/
          ...
        common/                ← guards, interceptors, pipes, decorators
        config/                ← Zod-validated env
        db/                    ← mssql pool, query helpers
        preprocess/            ← pure preprocessing fns + tests
        cache/                 ← Redis client + key derivation
        main.ts
      test/
    worker/                    ← NestJS app, no HTTP — BullMQ + cron
      src/
        jobs/
          warm-kpis.ts
          warm-charts.ts
          snapshot-refresh.ts
          retention-cleanup.ts
        main.ts
      test/
  packages/
    contracts/                 ← shared TS types, Zod schemas, OpenAPI spec
      schemas/
      generated/               ← types generated from openapi.json
  docker/
    Dockerfile.api
    Dockerfile.worker
    docker-compose.dev.yml     ← SQL Server 2022 + Redis + api + worker
  .github/workflows/
  package.json                 ← pnpm workspaces
  tsconfig.base.json
```

The `contracts` package is consumed by both backend apps **and** the React frontend (as `@umt/contracts`), so DTO shape drift between client and server is structurally impossible — break the schema, break the build.

---

## 14. Frontend integration plan

The dashboard already has clean function boundaries (`filterMonthlyCad(effective)`, `filterApplicationUsage(effective)`, `filterRawSessions(effective)`, etc.). Cutover is per-chart, not big-bang.

| Phase | What happens |
|---|---|
| **A — Stand up the read path** | Read-only credentials provisioned. SQL drafts for each chart validated to reproduce the current mock-data charts within ±0.5%. No frontend changes yet. |
| **B — Build API behind a flag** | Frontend gains a `VITE_USE_BACKEND_API` env var. When off, today's mock paths run; when on, each chart's `filter*` function calls `api.*` instead. |
| **C — Per-chart cutover** in order of risk | 1. KPI strip 2. CAD share + Fluids/Sealings 3. Region charts 4. Application breakdown 5. Heatmaps + AppCompare |
| **D — Remove mocks** | Once every chart has run on the API in prod for two weeks with no parity issues, delete the mock data path entirely. |

The shared `@umt/contracts` workspace package keeps types in lockstep — the frontend imports DTO types directly from the same source the backend uses.

---

## 15. Risks & open questions

1. **Read-only credentials availability** — the DBA team needs to provision the scoped login on both test and prod, and ideally point the service at a read replica. This is the first dependency to unblock.
2. **Activity bucket definitions** — the four categories (validation / execution / block creation / viewing) need a confirmed mapping from raw action codes in the existing schema. Workshop with the analysts is the unblock; mapping lives in versioned in-code config.
3. **Fluids/Sealings rules** — same shape: needs a confirmed mapping from product line + application.
4. **PII / username policy** — confirm with security and legal that HMAC-hashed usernames in API responses satisfy the retention and access policy. If pseudonymization is required, swap HMAC for a salted lookup.
5. **Index coverage on the existing DB** — heavy date-range scans need supporting indexes on `(start_time, region, cad, product_line)` or similar. If the existing indexes are insufficient, we either ask the DBA team to add covering indexes on the replica (still read-only from us) or accept slightly higher latency offset by aggressive caching.
6. **Snapshot freshness** — is "nightly refresh + 15-min hot-key warm" enough? Some users may want intraday freshness on the KPI strip. Decide upfront; tighter cadence is cheap to enable.
7. **Multi-tenant scoping** — single Cooper Standard tenant is assumed. If other divisions need data isolation, a `tenant_id` filter is added to every endpoint and every SQL statement.
8. **Schema drift in the upstream DB** — since we don't own that schema, a producer-side rename of a column will silently break us. Mitigation: contract tests in CI run weekly against the test DB and alert if the expected columns / types change. The rejected-row metric also surfaces this in production.
9. **Memory pressure** — Node defaults to a 4 GB heap. Wide queries must stream, never materialize. Integration tests assert heap stays under 1.5 GB on a 100k-row scan.
10. **Event-loop sensitivity** — heavy preprocessing on the API process would block requests. That's why the cache warmer runs in a separate worker container; the API only ever processes small per-request payloads.

---

## 16. 8-week MVP

| Week | Deliverable |
|---|---|
| 1 | pnpm monorepo, NestJS scaffolds for api + worker, mssql pool wiring, Zod-validated config, CI green, Docker Compose dev env (SQL Server 2022 + Redis) |
| 2 | Read-only credentials provisioned in test, query drafts for KPI strip + monthly-cad + cad-share + region-cad, parity SQL vs current mock data (±0.5%) |
| 3 | Preprocessing module (all 11 rules) + unit tests; alias maps, activity map, fluids/sealings rules under versioned in-code config |
| 4 | KPI + monthly-cad + cad-share + region-cad endpoints live behind Entra ID; Redis result cache; OpenAPI export; `@umt/contracts` package consumed by frontend |
| 5 | All remaining chart endpoints; `/sessions` cursor pagination + NDJSON streaming option |
| 6 | BullMQ + cron cache warmer (hot keys), snapshot pointer, nightly full refresh; Bull Board admin UI |
| 7 | k6 perf hardening, OTel observability, alerts, helmet, throttler, ZAP scan, audit log to dedicated DB |
| 8 | Frontend flag-cutover for all charts in test → prod, two-week parity watch begins |

---

## 17. What this plan does **not** do

Worth stating explicitly so scope is clear:

- **No writes to the existing UMT database.** Schema, data, and indexes stay exactly as they are today.
- **No new data warehouse, no ETL into a warehouse we own.** All aggregation happens in the Node application layer and is cached in Redis.
- **No replacement of any producer / source-of-truth system.** The producers keep writing to the existing DB unchanged.
- **No migration of historical data.** We read 5 years of history live (cached) from where it already lives.

Anything beyond reading, processing, and serving is out of scope for v1.
