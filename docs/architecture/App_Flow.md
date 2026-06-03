# Application Flow & Logical Architecture

## 1. Bootstrap Sequence (The Matrix Connection)
The application follows a strictly sequenced initialization to ensure data integrity and security:

1.  **Auth Handshake:** `AuthLayer.tsx` attempts to retrieve a Supabase session. If unauthenticated, it presents the "Executive OTP Gate."
2.  **Whitelist Verification:** The server-side logic verifies the authenticated email against the `whitelist` table in PostgreSQL.
3.  **Config Acquisition:** Once verified, the frontend fetches system configurations (Supabase Keys, Sheet IDs) from `/api/v1/config`.
4.  **Data Ingestion:** `App.tsx` calls `RevenueService.getRevenueData()`, which pulls from the live PostgreSQL instance.
5.  **Engine Boot:** The raw data is passed to the **Web Worker** (`worker.js`), which initializes the `ChronologicalIndexer` and calculates the first set of KPIs.
6.  **UI Dissolve:** Once KPIs are ready, the global loader dissolves, revealing the dashboard.

## 2. Interactive Cascade (Filter Flow)
The system uses a "Cascading Filter" model. Selecting a higher-level filter automatically restricts the options in lower-level widgets:

*   **Financial Year:** Sets the global chronological boundary.
*   **Segment (Sidebar):** Isolates the primary business vertical.
*   **Sales Head (Controller):** Filters customers and SKUs belonging to that manager.
*   **Customer:** Further restricts SKU views.
*   **SKU:** Final leaf node in the drill-down.

## 3. Data Synchronization Loop
*   **Zustand Store (`useStore.ts`):** Serves as the single source of truth for filters and analytical outputs.
*   **Worker Sync:** Every filter change triggers a `postMessage` to the Web Worker.
*   **Reflow:** The Worker returns a `COMPUTE_COMPLETE` event. The Store updates `stats`, triggering a high-performance reflow of all Chart.js instances and Matrix tables.

## 4. Navigation Architecture
*   **Master Widget:** A toggleable container between the **Revenue Matrix** (tabular grid) and **Revenue Velocity** (stacked bar/line chart).
*   **Chronological Scrubbing:** Keyboard `ArrowLeft/Right` events modify the `endDate` in the Store, triggering a full data engine recalculation to show historical "snapshots."
*   **Metric Switching:** `Alt+A/M/Q` hotkeys immediately swap the system between **Amount (₹)**, **MW**, and **Qty (Units)** views.
