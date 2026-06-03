# Implementation Guide: Senior Structural Standards

## 1. Monorepo Organization
The project is structured as an **NPM Workspace monorepo** to ensure senior-grade scalability:

*   `apps/web`: The React frontend application.
*   `apps/api`: The Node.js (ESM) backend gateway.
*   `packages/shared`: The core isomorphic logic library.
*   `database/`: Centralized schema and migration management.
*   `monitoring/`: Dedicated logging and metrics instrumentation.

## 2. Shared Engine Protocols (@revenue/shared)
All analytical calculations **must** occur within the shared package. 
*   **Rule:** Never duplicate KPI math in the React components. 
*   **Workflow:** Modify logic in `packages/shared/src/index.ts` -> Build package -> Shared build script automatically copies the updated engine to `apps/web/public/data-logic.js` for use by the Web Worker.

## 3. Backend Implementation (Layered Architecture)
Backend development must strictly follow the **Controller-Service-Repository** pattern:

1.  **Repository (`repositories/`):** Pure SQL execution and DB connection management.
2.  **Service (`services/`):** High-level business logic, data sanitization, and caching coordination.
3.  **Controller (`controllers/`):** HTTP request handling and response orchestration.
4.  **Routes (`routes/`):** RESTful endpoint definitions.

## 4. Frontend Implementation (Domain-Driven Modules)
Frontend code is organized by **Business Domain** rather than file type:

*   `src/modules/revenue`: All components related to revenue tracking.
*   `src/modules/auth`: The authentication gateway.
*   `src/modules/dashboard`: Analytical boards and executive stories.
*   `src/modules/shared`: Common UI elements (Sidebar, Tooltip).

**Constraint:** Components must use the `@/` path alias to import from other modules (e.g., `import { useStore } from '@/store/useStore'`).

## 5. Coding Mandates
*   **Performance:** All sorting must use `toSorted()` (ES2023) to avoid work waste.
*   **Accessibility:** Every interactive `div` or `th` must have a `role="button"`, `tabIndex`, and `onKeyDown` listener.
*   **Strict Typing:** `any` is prohibited in critical data paths. Every analytical output must adhere to the `AnalyticalOutput` interface in `@revenue/shared`.
*   **Executive Amount Standard:** Currency formatting must always use `MetricFormatter.formatValue`. All values passed to the UI must be normalized to Crores (Value / 10,000,000) with 2-decimal precision.

