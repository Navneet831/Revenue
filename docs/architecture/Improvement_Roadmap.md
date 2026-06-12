# Improvement Roadmap — Grew Analytics

Status assessment of 2026-06-12, based on a full audit of the codebase plus the three design
references in the repo root (`DESIGN-supabase.md`, `DESIGN-apple.md`, `DESIGN-notion.md`).
Items marked ✅ were fixed in this pass; everything else is prioritized backlog.

---

## 1. Security

| Item | Status |
|---|---|
| API JWT verification was fake (any `Authorization` header passed) — now verified against Supabase Auth (`/auth/v1/user`) with a 60s token cache; `req.user` carries id/email | ✅ Fixed |
| Logout never called `supabase.auth.signOut()` — session survived in localStorage and auto-logged the user back in | ✅ Fixed |
| `/api/git/commits` was public and spawned a child process per request — now authenticated + 60s cached, uses `execFileSync` (no shell) | ✅ Fixed |
| CORS was wide open (`cors()`) — now an explicit origin allowlist (override via `CORS_ORIGINS` env) | ✅ Fixed |
| Sentry DSN was hardcoded in the bundle — now opt-in via `VITE_SENTRY_DSN` | ✅ Fixed |

### Remaining (priority order)
1. **Move the whitelist check server-side.** The client queries the `whitelist` table with the
   anon key, which means RLS must allow anonymous reads — anyone with the (public) anon key can
   enumerate authorized emails, and a tampered client can skip the check entirely. Replace with:
   - RLS on `whitelist`: `SELECT` only where `email = auth.jwt()->>'email'`, and
   - enforce membership in `authenticateJWT` (one extra Supabase query, cacheable).
2. **Row Level Security on every data table.** Revenue/inventory tables should have RLS policies
   keyed to `auth.uid()` / role claims. This is the core of the Supabase security model and what
   makes adding modules safe by default: a new module's tables get policies before it ships.
3. **Content Security Policy.** `helmet({ contentSecurityPolicy: false })` — define a CSP once the
   inline boot-loader script in `index.html` is moved to a file (it is the only blocker).
4. **Tighter rate limit on auth-adjacent endpoints** (`/api/v1/config`) and per-user (not per-IP)
   limits once `req.user` is available.
5. **Secrets hygiene.** `.env` exists in the repo root and `apps/api/` — ensure both are
   gitignored and rotated if ever committed; add `.env.example` documenting required vars
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CORS_ORIGINS`, `VITE_SENTRY_DSN`).

## 2. Auditability

- ✅ Auth events now produce structured logs: `auth_verified` (email, route, IP),
  `auth_invalid_token`, `auth_missing_token` — every data access is attributable to a user.
- **Next: an `audit_log` table in Supabase** (`actor_email, action, entity, payload, at`),
  written from the API on every authenticated mutation/export. Supabase RLS makes it append-only
  (no `UPDATE`/`DELETE` policies). Surface it in-app as an "Activity" panel — this is what makes
  the system *verifiable by the user*, not just logged.
- CSV exports and filter-heavy views should log what was exported and by whom.
- Keep `/metrics` (Prometheus) but bind it to an internal port or token in production.

## 3. Scalability & Modularity (the Supabase-style architecture)

The goal: each new module (Inventory, Procurement, …) is a vertical slice that plugs into a
stable shell, with Postgres + RLS as the trust boundary and the API as a thin gateway.

1. **Module registry + real routes.** `activeApp` in the Zustand store is a string switch inside
   `App.tsx`. Introduce `react-router` with one route per module (`/revenue`, `/inventory`) and a
   registry (`modules/registry.ts`: id, label, icon, route, lazy component). The sidebar and the
   "Module In Development" placeholder render from the registry. `React.lazy` each module so the
   bundle stops growing per module (the main chunk is already 511 kB — code-splitting is due).
2. **One vertical-slice convention per module:** `modules/<name>/{components,hooks,services,worker}`
   + an API route file (`apps/api/routes/<name>Routes.js`) + a repository + SQL migrations in
   `database/`. Revenue already approximates this — codify it so the next module copies the shape.
3. **Shared session, one Supabase client.** ✅ Done (`services/supabaseService.ts`) — AuthLayer and
   ApiClient previously each created their own client (duplicate config fetches, racing storage).
4. **Server scale path.** Stateless API (the new token cache is per-instance but only an
   optimization) → can run N instances behind a load balancer. Redis is already a dependency:
   move hot revenue aggregates there with short TTLs. Postgres connection pooling via Supabase's
   pooler (pgBouncer) when instance count grows.
5. **Data load path.** TanStack Query + IndexedDB cache + Web Worker compute is a good pattern —
   keep heavy aggregation in the worker per module, and paginate/aggregate server-side once a
   module's raw dataset exceeds what the browser should hold.
6. **Keep contracts in `packages/shared`.** Types like `FilterConfig` are shared today; new module
   request/response types belong there too, so web and API can't drift.

## 4. Design System (synthesis of the three references)

Current state: dense dark "matrix" theme — neon emerald glows, 3D/noise effects, 8–11px uppercase
microtype, ~20 hardcoded hex surfaces (`#0b101e`, `#111620`, `#0F1219`…). It reads as a hacker
console, not an executive analytics product. All three references agree on the antidote:

**Shared principles across Supabase / Apple / Notion:**
- **One accent color, used scarcely.** Emerald stays (Supabase's `#3ecf8e` family) but only for
  the primary action and "lit" states — not for glows, borders, icons, and text simultaneously.
- **A calibrated neutral ladder instead of ad-hoc hexes.** Define ~8 surface/ink tokens and ban
  raw hex in components.
- **Typography does the hierarchy, not decoration.** Inter (closest open analogue to all three
  brands' faces), weight 500–600 for headings with negative tracking, body at a *readable* size.
  Today's 8–10px all-caps labels fail accessibility and executive presentability — minimum 12px
  body, 13–14px for data tables.
- **8px spacing grid** (`2/4/8/12/16/24/32/64`) replacing arbitrary `p-1.5`/`py-0.5` choices.
- **Restraint in elevation.** Hairline borders + one or two soft shadow levels. Remove
  `card-3d`, `btn-3d`, `chart-noise-layer`, and glow shadows — Apple's rule: if you need emphasis,
  change the surface, don't add chrome.
- **Radius grammar:** 6–8px for buttons/inputs (square-ish, technical — Supabase), 12px cards,
  16px modals. One grammar, no mixing.

**Concrete first steps:**
1. Create `apps/web/src/styles/tokens.css` (CSS variables) + map into `tailwind.config` theme:
   `--surface-0/1/2`, `--ink/-secondary/-muted/-faint`, `--hairline`, `--accent/-deep`,
   `--radius-sm/md/lg`, spacing scale. Dark theme first (matches current product), with the
   token layer making a future Notion-warm light mode a swap, not a rewrite.
2. Sweep components to tokens module-by-module (Revenue header → KPI cards → matrix → sidebar).
3. Type scale: 20/16/14/13/12 (display/section/body/table/caption) at weights 600/500/400 —
   replace the 8–10px uppercase-tracking-tighter pattern everywhere.
4. Auth screen: drop the starfield/wobble/typewriter for the product's own aesthetic — a quiet
   card (Notion's `ex-auth-form-card`) on the dark canvas with one emerald CTA reads as
   trustworthy enterprise software; the current effects read as a demo.

## 5. Testing & Verifiability

- ✅ TypeScript typechecking was silently broken (tsconfig `baseUrl` deprecation aborted `tsc`);
  fixed, and the 4 real type bugs it had been hiding are fixed (including a runtime one:
  `Breadcrumbs` read `allSegments` from the wrong object, so the segment filter chip never showed).
- **The e2e suite is largely non-functional**: 12 of 19 tests fail because they rely on a
  `bypass_auth` query param the React app intentionally ignores (`auth_enforcement.spec.js`
  asserts it must not work) and nothing sets `window.__playwright_test__`. Fix: a shared Playwright
  fixture that calls `page.addInitScript(() => { window.__playwright_test__ = true })` for
  functional specs (auth specs excluded), plus a seeded/mocked data route for deterministic
  dashboards. Until then, only the 7 auth/integrity tests are meaningful.
- Add API integration tests (supertest): 401 paths, config endpoint, rate limiting.

## 6. Handling user load

- Web: code-split per module (see §3.1), `manualChunks` for echarts/Sentry, lazy-load the
  insights/stories panels. 511 kB main chunk → target < 250 kB initial.
- API: per-instance statelessness (done), Redis for hot aggregates, response compression
  (`compression` middleware), `PORT` from env instead of hardcoded 8000.
- Supabase: RLS-backed direct reads can offload simple queries from the API entirely — the API
  then exists for cross-cutting concerns (aggregation, exports, audit) rather than CRUD.
