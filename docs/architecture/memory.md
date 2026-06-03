# Project Memory: Grew Revenue Analytics

## Context
Migration of a high-performance, executive-level revenue dashboard from a monolithic HTML/JS architecture to a modern React (TypeScript) + Node.js (Express) stack. The system is designed for real-time visualization of revenue velocity, SKU performance, and customer concentration.

## Architectural Mandates
- **Performance:** Sub-100ms analytical computations using binary-indexed time-series data.
- **Security:** Strict Supabase/PostgreSQL authentication. ZERO mock data leakage in production.
- **UX:** "Executive Slate" aesthetics—dark mode, high-contrast clarity, and keyboard-accessible interactions.

## Critical Technical Debt / Findings
- **Data Engine Sync:** The analytical logic exists in both `@revenue/shared` and `apps/web/public/data-logic.js`. Parity is strictly enforced by the build pipeline.
- **Mock Data Purge:** ALL mock data generators (`mockData.js`) and fallbacks have been removed. System now follows a "Fail-Fast" integrity mandate.
- **Backend Refinement:** Implemented a `RevenueRepository` (SOLID) to decouple SQL execution from Express routes.

## MIT Engineering Refinements
- **Palantir-ready Architecture:** Modular monorepo with strict package boundaries (`apps/*`, `packages/*`).
- **High-Integrity Verification:** Added `no_mock_data.spec.js` and `load_test.js` to ensure production stability.
- **Port Enforcement:** Strictly constrained to `127.0.0.1:8000` to prevent environmental drift and ensure secure auth callback resolution.
- **Isomorphic Analytics:** Using a unified `@revenue/shared` package to ensure identical KPI math on both Client and Server.

## Data Strategy: From JSON to Binary?
While the system is currently migrating to **PostgreSQL JSONB** for flexible schema management, a senior design engineer would evaluate binary serialization (Protobuf or FlatBuffers) for "tons" of data transfer.
*   **Current (JSONB):** Optimal for developer velocity and dynamic SKU metadata.
*   **Scale-Up (Binary):** If the dataset grows to millions of rows per request, we should implement a binary protocol to reduce payload size by ~40-60% and eliminate CPU-heavy JSON parsing on the client.

## Key Files
- `packages/shared/src/index.ts`: The central brain for all KPI, Matrix, and Chart computations.
- `apps/web/src/App.tsx`: Orchestrates the bootstrap sequence (auth -> config -> data fetch -> engine boot).
- `apps/web/src/components/AuthLayer.tsx`: Enforces security session integrity.

## Decisions Record
- **2026-06-03:** Hardcoded Port 8000 enforcement and implemented CodeRabbit architectural auditing.
- **2026-06-03:** Added `autocannon` load testing to measure concurrency handling.
- **2026-06-03:** Removed `bypass_auth` and purged `mockData.js`. Implemented `RevenueRepository`.
- **2026-06-03:** Migrated to Monorepo structure using NPM Workspaces for scalable system design.
- **2026-06-03:** Implemented `toSorted()` (ES2023) to optimize immutable sort operations.
- **2026-06-03:** Dynamic Legend Filtering: SKU legend now strictly filters based on active transactions in the current period.
