# Backend Schema: Grew Revenue Database

## 1. Table: `public.revenue`
This is the primary fact table containing all financial transactions.

| Column | Type | Business Logic Mapping |
| :--- | :--- | :--- |
| `Invoice date` | timestamp | `date` |
| `Segment` | varchar | `segment` |
| `Sales Head` | varchar | `salesHead` (Decoded from manager column) |
| `Cust_name` | varchar | `customer` |
| `WP` | varchar | `wp` (SKU Code) |
| `Value` | numeric | `val` (Gross Revenue) |
| `SalesQty` | numeric | `qty` (Units Sold) |
| `MW` | numeric | `mw` (Megawatt Capacity) |
| `UnitPrice ₹` | numeric | `unitPrice` |
| `Revenue` | varchar | `revenueStatus` (Checked for 'Pending' keyword) |

## 2. Table: `public.whitelist`
Controls access to the Executive Gateway.

| Column | Type | Purpose |
| :--- | :--- | :--- |
| `email` | varchar | The primary key used for Supabase Auth verification. |
| `role` | varchar | Defines user permissions (Executive, Manager). |
| `created_at`| timestamp | Audit metadata. |

## 3. Table: `public.app_config`
Global system parameters.

| Column | Type | Purpose |
| :--- | :--- | :--- |
| `key` | varchar | Unique identifier (e.g., 'SHEET_ID'). |
| `value` | text | Configuration string. |

## 4. Data Integrity Strategy
*   **JSONB Migration:** Transaction-specific metadata that does not fit the core schema is stored in the `metrics` JSONB column (future-proofed).
*   **NULL Handling:** The `RevenueService` on the backend filters out rows where `Invoice date` or `Value` is NULL to ensure mathematical integrity.
*   **Case Sensitivity:** The isomorphic `DataLogic.buildKeyMap` engine automatically handles variations in database column casing (e.g., `Salesqty` vs `salesqty`).
