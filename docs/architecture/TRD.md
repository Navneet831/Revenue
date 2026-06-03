# Technical Requirements Document (TRD): Grew Revenue Analytics

## 1. System Architecture
The system follows a **Modular Monorepo** pattern using NPM Workspaces to ensure strict separation of concerns and scalability.

*   **Frontend (`apps/web`):** React 18 (TypeScript) + Vite. Uses a Domain-Driven Design (DDD) module structure.
*   **Backend (`apps/api`):** Node.js (ESM) + Express. Implements a strict Controller-Service-Repository pattern.
*   **Shared Core (`packages/shared`):** Isomorphic TypeScript package containing the central analytical engine and domain types.

## 2. Technical Stack
*   **Runtime:** Node.js (Latest LTS)
*   **Persistence:** PostgreSQL (JSONB for semi-structured transaction metrics)
*   **Auth:** Supabase Auth (JWT) with server-side whitelist verification.
*   **Analytics:** Shared `@revenue/shared` engine with O(log N) binary indexing.
*   **Visualisation:** Chart.js 4.x (highly customized via plugins).
*   **Monitoring:** Prometheus + Grafana + Thanos (long-term retention) + Sentry (Error tracking).

## 3. Data Pipeline & Performance
### A. Isomorphic Logic
To prevent "logic drift," the analytical calculations (MTD/YTD) are defined in `@revenue/shared`. This code is compiled to CJS for the backend and ESM for the frontend Web Worker.

### B. High-Concurrency Processing
Heavy aggregations are offloaded to a dedicated **Web Worker** (`worker.js`). Communication occurs via structured cloning, with the UI thread receiving a "ready-to-render" result object.

### C. Repository Pattern
Backend data access is centralized in `RevenueRepository.js`. This layer handles SQL execution, metric instrumentation, and pool management, ensuring the Service layer remains pure business logic.

## 4. Security Infrastructure
*   **Port Enforcement:** Hard-wired to `127.0.0.1:8000`.
*   **JWT Integrity:** All data endpoints require a valid Supabase JWT.
*   **Zero-Mock Policy:** Production path contains no synthetic fallbacks. Automated tests verify `mockData.js` is absent from disk.
*   **Rate Limiting:** IP-based throttling on all API endpoints.

## 5. Deployment & CI/CD
*   **CI:** GitHub Actions (Lint -> Type-check -> Build -> Playwright E2E).
*   **CD:** Multi-region deployment to Vercel (Frontend) and high-availability Node clusters (Backend).
