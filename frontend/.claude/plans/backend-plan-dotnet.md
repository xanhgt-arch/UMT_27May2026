# UMT2 Backend Plan — .NET Variant

Comprehensive plan for the UMT2 dashboard backend assuming a .NET stack.
Context: the old UMT used SQL Server with 5 years of data, separate test and
production databases, and an ASP.NET MVC backend.

---

## 1. Tech stack recommendation

| Layer | Pick | Why |
|---|---|---|
| Runtime | **.NET 8 (ASP.NET Core Minimal API or Web API)** | Same team skillset as the old MVC app; first-class SQL Server tooling; great perf; LTS until Nov 2026 |
| ORM | **EF Core 8 + Dapper** | EF Core for command-side (writes/admin), Dapper for read-heavy analytic queries where raw SQL wins |
| DB | **SQL Server** (existing) + read replica | Reuses 5 years of history; replica isolates dashboard load from OLTP |
| Cache | **Redis (StackExchange.Redis)** | Aggregated chart payloads, KPI snapshots, JWT denylist |
| Background jobs | **Hangfire** (or `BackgroundService` if simple) | Nightly aggregation, retention, materialized-view refresh |
| Auth | **Azure AD / Entra ID via OIDC** + JWT | Matches Cooper Standard SSO; no password DB to own |
| API style | **REST + JSON** with optional GraphQL endpoint later | The frontend already shape-fetches via small TypeScript functions — REST maps cleanly |
| Validation | **FluentValidation** | Per-DTO, integrates with Minimal API filters |
| Logging | **Serilog → Seq/Application Insights** | Structured logs; correlation IDs |
| Tests | **xUnit + Testcontainers (SQL Server) + Verify** | Real DB in CI for ETL/aggregation; snapshot tests for API payloads |

> **Fork:** If you'd rather use Node/Python so the dashboard team owns it end-to-end, swap to FastAPI/NestJS. The schema and aggregation strategy below don't change. I'd lean .NET because the historical data and DBA muscle memory are already there.

---

## 2. Database strategy

### 2.1 Two databases, three environments

```
UMT_OLTP_PROD  (legacy, untouched)         → producers write raw events here
UMT_OLTP_TEST  (legacy mirror)             → QA writes here

UMT_DW_PROD    (new analytics DB)          → dashboard reads from here
UMT_DW_TEST    (new analytics DB)          → dashboard test env reads from here
UMT_DW_LOCAL                               → dev seed (anonymized subset, 90 days)
```

**Don't query the OLTP database directly from the dashboard.** Reasons:
- 5 years of rows means analytic queries become table scans.
- The new dashboard runs many concurrent aggregations (per chart, per filter combo) — that's a noisy neighbor for the producer apps.
- Schema changes for analytics shouldn't touch the OLTP producers.

So: **OLTP → ETL → DW (star-schema'd)** → REST API → frontend.

### 2.2 Connection strings

`appsettings.{Environment}.json` → `ConnectionStrings:Oltp` + `ConnectionStrings:Dw`. Secrets via **Azure Key Vault** (or AWS Secrets Manager), never committed.

---

## 3. Data model (warehouse / analytics schema)

A **star schema** beats a normalized OLTP schema for the chart workloads we already render. One fact table, several dim tables, and pre-built aggregates.

### 3.1 Fact

```sql
-- fact_session: one row per UMT session (matches RawSessionRow on the frontend)
CREATE TABLE fact_session (
  session_id        BIGINT PRIMARY KEY,
  start_time_utc    DATETIME2 NOT NULL,
  end_time_utc      DATETIME2 NULL,
  duration_seconds  INT NOT NULL,
  user_key          INT NOT NULL,        -- FK dim_user
  cad_key           SMALLINT NOT NULL,   -- FK dim_cad        (CATIA / NX / Other)
  app_key           INT NOT NULL,        -- FK dim_application
  product_line_key  SMALLINT NOT NULL,   -- FK dim_product_line
  region_key        SMALLINT NOT NULL,   -- FK dim_region     (NA / EU / ASIA / SA)
  domain_key        SMALLINT NOT NULL,   -- FK dim_domain
  hardware_key      SMALLINT NOT NULL,   -- FK dim_hardware
  status_key        SMALLINT NOT NULL,   -- FK dim_status     (success / fail / abort)
  validation_count  INT NOT NULL DEFAULT 0,
  execution_count   INT NOT NULL DEFAULT 0,
  block_create_cnt  INT NOT NULL DEFAULT 0,
  view_op_count     INT NOT NULL DEFAULT 0,
  is_fluids         BIT NOT NULL DEFAULT 0,
  is_sealings       BIT NOT NULL DEFAULT 0,
  source_row_hash   BINARY(32) NOT NULL,  -- for idempotent re-ETL
  ingested_at_utc   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Partition by month, columnstore index for analytic scans
CREATE CLUSTERED COLUMNSTORE INDEX cci_fact_session ON fact_session;
CREATE NONCLUSTERED INDEX ix_fact_session_time     ON fact_session (start_time_utc);
CREATE NONCLUSTERED INDEX ix_fact_session_filters  ON fact_session (region_key, cad_key, product_line_key) INCLUDE (start_time_utc);
```

### 3.2 Dimensions

`dim_user`, `dim_cad`, `dim_application`, `dim_product_line`, `dim_region`, `dim_domain`, `dim_hardware`, `dim_status` — small lookup tables with SCD Type-1 (overwrite on change; we don't need historical re-labeling). Each has an integer surrogate key + business key + display label + `is_active`.

### 3.3 Pre-aggregated tables (the secret sauce for chart speed)

These are the *real* tables the API reads. The fact table exists for ad-hoc queries and re-aggregation; charts hit the rollups.

```sql
agg_monthly_cad        (year, month, cad_key, sessions, distinct_users)
agg_monthly_region     (year, month, region_key, cad_key, sessions)
agg_monthly_app        (year, month, app_key, validation, execution, block_create, view_ops, total)
agg_app_function       (app_key, validation, execution, block_create, view_ops)
agg_region_cad         (region_key, cad_key, sessions)
agg_product_line       (product_line_key, sessions)
agg_hardware           (hardware_key, sessions)
agg_domain             (domain_key, sessions)
agg_year_heatmap       (year, day_of_year, sessions)
agg_fluids_sealings    (year, month, is_fluids, is_sealings, sessions)
agg_kpi_snapshot       (snapshot_date, busiest_month, top_app, apps_in_use, top_product_line, top_region, ... )
```

Each row keeps `dim_*_key` ints so the API can JOIN to lookups for display labels but the aggregates stay tiny. Nightly refresh keeps them in step with new sessions.

### 3.4 Why not indexed views?

Tempting, but they'd lock writes on the producer. Materialized aggregate tables refreshed by Hangfire give us the same read perf without coupling.

---

## 4. ETL / ingestion pipeline

### 4.1 Stages

```
[OLTP changes]
   │  (1) CDC or watermark query
   ▼
[stage.raw_session]      ← exact OLTP shape, append-only
   │  (2) preprocessing
   ▼
[stage.clean_session]    ← validated, normalized, deduped
   │  (3) conform
   ▼
[fact_session + dim_*]   ← star schema in DW
   │  (4) roll up
   ▼
[agg_* tables]           ← what the API queries
```

### 4.2 Stage 1 — Extract

Two options; pick based on what the OLTP DBA team allows:

1. **SQL Server Change Data Capture (CDC)** on the OLTP session table. Cleanest, near-real-time, low impact.
2. **Watermark query** (`SELECT … WHERE updated_at > @lastWatermark`) every N minutes from a read replica. Simpler, fine if updates are monotonic and there's a reliable `updated_at`.

A nightly **full-reconcile pass** runs even when CDC is on, to catch missed events and recompute row hashes.

### 4.3 Stage 2 — Preprocessing

Each `stage.raw_session` row goes through deterministic steps:

1. **Schema validation** — required columns present, types correct, FKs resolvable. Bad rows go to `stage.rejected_session` with a reason code; they don't break the batch.
2. **Timezone normalization** — every timestamp converted to UTC. Store original tz in `dim_user` if we need to render local-time later.
3. **Trim & casefold** — strings trimmed; CAD/region/status uppercased; application names mapped via `dim_application_alias` so "NX12", "NX 12", "Siemens NX" all collapse.
4. **Null / unknown handling** — categorical nulls map to an explicit `UNKNOWN` dimension row (key = 0) so charts always have a slot rather than silently dropping rows.
5. **Outlier flagging** — sessions with `duration_seconds <= 0` or `> 24h` get a `quality_flag`. They still land in the fact (for honesty) but are excluded from KPI rollups via a `WHERE quality_flag = 0` filter.
6. **De-duplication** — `source_row_hash = SHA256(session_id || start_time || user || cad || application)` is the idempotency key. Re-running ETL never produces dupes.
7. **Bot / synthetic traffic filter** — known QA user list and known load-test workstation names mapped to `is_synthetic = 1`, excluded from prod KPIs by default but available in DW for QA debugging.
8. **Activity bucket derivation** — old DB stores raw action logs; we derive the four buckets (validation / execution / block creation / viewing) via a deterministic SQL CASE on `action_code`. The mapping lives in a versioned `ref_activity_map` table so analysts can update it without code deploys.
9. **Fluids/Sealings flag** — derived from product line + application; rules table `ref_product_classification`.
10. **Region inference** — if `region` is null on a session, infer from user's office code via `dim_user.region_default`.
11. **PII scrub** — usernames hashed (HMAC with rotating key) for the analytics fact; the raw username only lives in `dim_user` keyed by surrogate, gated behind a role.

### 4.4 Stage 3 — Conform / load

Merge into dimensions (UPSERT on business key), then `INSERT … SELECT` into `fact_session`. All wrapped in a transaction per batch; on failure the whole batch rolls back and Hangfire retries with exponential backoff.

### 4.5 Stage 4 — Roll up

For each `agg_*` table, an idempotent `MERGE` runs after the load. The merge is keyed on the aggregate's grain so re-running over the same window just overwrites that window's rows. Nightly job re-aggregates the last 7 days to absorb late-arriving rows.

### 4.6 Schedule

| Job | Cadence |
|---|---|
| Incremental CDC extract → stage | every 5 min |
| Preprocess + load fact | every 15 min |
| Refresh hot aggregates (last 7 days) | every 15 min |
| Full rebuild of all aggregates | nightly 02:00 |
| KPI snapshot for Home page | nightly 02:30 |
| Retention enforcement | nightly 03:00 |
| Vacuum / index rebuild | weekend |

### 4.7 Retention

Keep 5 years of raw in OLTP (status quo) and **2 years of fact + 5 years of aggregates** in DW. The aggregates are tiny so 5+ years is cheap; the fact table is where storage cost lives.

---

## 5. API design

### 5.1 Shape that matches the frontend

The frontend already has well-defined chart contracts (look at `filterMonthlyCad`, `filterApplicationUsage`, etc.). The API should return those shapes directly so the frontend swap is one-line per chart (replace the local function with `await api.monthlyCad(filters)`).

### 5.2 Endpoint catalogue (v1)

```
GET  /api/v1/kpis?...filters                  → home KPI strip
GET  /api/v1/charts/monthly-cad?...           → MonthlyUsageTotal
GET  /api/v1/charts/application-usage?...     → ApplicationBars / ApplicationDonut
GET  /api/v1/charts/cad-share?...             → CadBars (the pie)
GET  /api/v1/charts/region-cad?...            → RegionBars
GET  /api/v1/charts/region-monthly?...        → RegionMonthly
GET  /api/v1/charts/heatmap-year?...          → YearHeatmap
GET  /api/v1/charts/heatmap-monthly?...       → MonthlyHeatmap
GET  /api/v1/charts/app-compare?...           → AppCompare
GET  /api/v1/charts/fluids-sealings?...       → FluidsSealingsSplit
GET  /api/v1/charts/product-line?...
GET  /api/v1/charts/hardware?...
GET  /api/v1/charts/domain?...
GET  /api/v1/sessions?...                     → paged raw session table for VdiUsers/Sessions pages
GET  /api/v1/filters/options                  → dropdown values (regions, CADs, …)
GET  /api/v1/health                           → liveness/readiness
GET  /api/v1/version                          → build SHA + DW snapshot id
```

### 5.3 Filter contract

Single shared query-string schema across every chart endpoint:

```
?from=2024-01-01&to=2026-05-19
&cad=CATIA,NX
&region=NA,EU
&productLine=...
&domain=...
&hardware=...
&application=...
&status=success
```

Server-side validation: dates ≤ today, enum values must exist in the corresponding `dim_*`, max range ≤ 5 years (return 400 with details otherwise). Mirrors the `FilterDim[]` definitions already on the frontend.

### 5.4 Response envelope

```jsonc
{
  "data": [...],
  "meta": {
    "filters": { ...echo of applied filters... },
    "snapshotId": "2026-05-19T02:30:00Z",
    "rowCount": 12,
    "fromCache": true
  },
  "error": null
}
```

Matches the CLAUDE.md "API response format" pattern (success indicator, payload, error, metadata).

### 5.5 Pagination

`/sessions` is the only large list endpoint. Cursor pagination (`?cursor=<opaque>&limit=200`), max limit 1000.

### 5.6 Versioning

URL-prefixed `/v1` so we can ship breaking changes without coordinating frontend deploys.

---

## 6. Caching

Two layers:

1. **Per-request server cache (Redis)** — key = `sha256(endpoint + sorted filter json + snapshotId)`. TTL 15 min, matches the agg refresh cadence. Invalidated on nightly rebuild by bumping `snapshotId`.
2. **HTTP cache headers** — `Cache-Control: private, max-age=60, stale-while-revalidate=300` so the browser also dedupes rapid filter toggles.

For the KPI strip (which doesn't take filters), cache for 1 hour.

---

## 7. Auth, authz, security

- **AuthN:** Entra ID OIDC, Authorization Code + PKCE. JWT bearer on every API call.
- **AuthZ:** Two roles for v1: `viewer` (all GETs) and `admin` (mapping table edits + ETL ops endpoints). Role claim resolved from an AD group.
- **Per-region data scoping:** optional — if you want a region lead to only see their region, add a `region_scope` claim and inject `WHERE region_key IN (...)` server-side.
- **CORS:** allowlist the dashboard origin only.
- **Rate limiting:** AspNetCoreRateLimit, 60 req/min/user by default; admin endpoints lower.
- **Headers:** HSTS, X-Content-Type-Options, X-Frame-Options DENY, strict CSP.
- **SQL injection:** parameterized queries everywhere; Dapper params, EF Core LINQ. No string concatenation into SQL.
- **PII:** username HMAC at ingestion, raw value only via `dim_user` join, only `admin` can fetch the unhashed name.
- **Secrets:** Azure Key Vault, no `.env` in repo, rotation policy 90 days.
- **Audit log:** every admin endpoint write goes to `audit_event` with actor, before/after, IP.

---

## 8. Environments and config

```
local      → dev SQL (Docker), seeded with 90 days of anonymized data, no SSO (dev token)
test       → UMT_DW_TEST, points at UMT_OLTP_TEST, real Entra ID test tenant
prod       → UMT_DW_PROD, points at UMT_OLTP_PROD, prod Entra ID
```

Strict env parity: same migrations run in all three. The only differences are connection strings, log levels, and feature flags.

---

## 9. Deployment & infra

- **Hosting:** Azure App Service (Linux, .NET 8) — easy slot swaps for blue/green. AWS ECS Fargate is a fine alternative.
- **CI:** GitHub Actions
  - `build-test`: restore, build, unit tests, integration tests with Testcontainers
  - `deploy-test`: on merge to `main`, deploy to test slot, run smoke tests
  - `deploy-prod`: manual approval → swap slots
- **Migrations:** EF Core migrations + a separate **DW migration project** for star-schema changes. Both run as a pre-deploy step against the target DB with `dotnet ef database update`.
- **Hangfire dashboard:** mounted at `/admin/jobs`, admin-only.
- **Health:** `/health/live` and `/health/ready` (the latter checks DB + Redis + last-successful-ETL timestamp).

---

## 10. Observability

- **Logs:** Serilog → Application Insights / Seq. Correlation IDs propagated end-to-end.
- **Metrics:** OpenTelemetry → Prometheus / Azure Monitor. Track: request latency p50/p95/p99 per endpoint, cache hit ratio, ETL batch duration, ETL row counts, rejected-row counts, DB CPU.
- **Tracing:** OTel spans across API → DB → Redis.
- **Alerts:**
  - ETL hasn't run in >2× expected interval
  - Rejected-row ratio >1% in a batch
  - P95 API latency >800ms for 5 min
  - DW write failure
  - 5xx ratio >1%

---

## 11. Testing strategy

| Test type | Target | Tools |
|---|---|---|
| Unit | Preprocessing rules, mapping fns | xUnit |
| Integration | ETL end-to-end with real SQL | Testcontainers |
| Contract | API responses match frontend's expected shapes | Verify snapshot tests + a shared schema package (`umt-contracts`) |
| Performance | Each chart endpoint < 200ms p95 with 5y data | NBomber / k6 |
| Security | OWASP ZAP automated scan in CI | ZAP |
| E2E | Dashboard renders against staging API | Playwright (already in your stack) |

Coverage gate: 80% lines on backend, matching the global rule.

---

## 12. Frontend ↔ backend migration plan

The dashboard already has clean function boundaries (`filterMonthlyCad(effective)` etc.). The cutover is per-chart, not big-bang:

1. **Phase A — Build DW + ETL** with prod data, no API yet. Validate by writing SQL that reproduces today's mock-data charts within ±0.5%.
2. **Phase B — Build API** behind a flag. Frontend has a `useBackendApi` flag (env var). When off, today's mock paths run; when on, each chart's `filter*` function calls `api.*` instead.
3. **Phase C — Per-chart cutover** in this order (low → high risk):
   1. KPI strip (single payload, easy to verify)
   2. CAD share + Fluids/Sealings (small data, easy diff)
   3. Region charts
   4. Application breakdown
   5. Heatmaps and AppCompare (most complex)
4. **Phase D — Remove mocks** once all charts run on the API in prod for two weeks with no parity issues.
5. **Phase E — Decommission** any old MVC endpoints the new dashboard never used; keep the OLTP producers running unchanged.

A **shared `umt-contracts` package** (TS types + .NET DTOs generated from a single OpenAPI spec) keeps shape drift impossible — break the contract, break the build.

---

## 13. Risks & open questions

1. **CDC permission** — does the OLTP DBA team allow enabling CDC on prod? If no, fall back to watermarked pulls from a read replica.
2. **Activity bucket definitions** — the four categories (validation / execution / block creation / viewing) need a confirmed mapping from raw action codes. I assumed there's an existing lookup; if not, this is a workshop with the analysts before ETL can ship.
3. **Username PII policy** — confirm with security/legal whether hashed usernames satisfy your retention and access rules, or whether they must be pseudonymized further.
4. **Snapshot timing** — is "yesterday close-of-business UTC" the right snapshot for the KPI strip, or do users want intraday freshness? Intraday is doable (rolling 15-min cache) but changes the alerting thresholds.
5. **Multi-tenant?** — single Cooper Standard tenant assumed. If other divisions need isolation, add `dim_tenant` early; retrofitting is painful.
6. **Old MVC API consumers** — anything else reading the old ASP.NET MVC endpoints? They need to keep working until those clients migrate.

---

## 14. 8-week MVP

| Week | Deliverable |
|---|---|
| 1 | Solution scaffold, CI, DW schema migration, dim seed data, Hangfire wiring |
| 2 | OLTP→stage extract (CDC or watermark), preprocessing rules, rejected-row table |
| 3 | Fact load, dimension upsert, idempotency, unit + integration tests for ETL |
| 4 | All `agg_*` tables, nightly + 15-min refresh jobs, parity SQL against current mock data |
| 5 | KPI + CAD-share endpoints, Entra ID auth, Redis cache, OpenAPI spec, `umt-contracts` package |
| 6 | All remaining chart endpoints, frontend flag-cutover for KPI + CAD-share in test env |
| 7 | Performance hardening, observability, alerting, security scan, audit log |
| 8 | Full per-chart cutover in test → prod, two-week parity watch begins |
