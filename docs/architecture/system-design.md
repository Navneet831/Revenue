# System Architecture: Grew Revenue Analytics

## 1. Overview
A high-performance analytical platform for executive revenue monitoring. Built for sub-100ms latency on multi-million row datasets using client-side binary indexing.

## 2. Component Stack

### Frontend (Executive Slate)
- **Framework:** React 18+ (TypeScript)
- **State Management:** Zustand (Global store for filters and analytical outputs)
- **Styling:** Tailwind CSS (Executive Hardware Standard - Dark Mode)
- **Visualisation:** Chart.js + react-chartjs-2 (Optimised for high-frequency updates)
- **Performance:** Offloads heavy data processing to Web Workers (`worker.js`)

### APIs & Backend Logic
- **Runtime:** Node.js (Express)
- **Security Middleware:** Helmet, CORS, Rate Limiting
- **Analytics Engine:** `data-logic.ts` - Shared isomorphic logic for server/client
- **Endpoints:**
    - `GET /api/v1/revenue`: Authenticated data retrieval
    - `GET /api/v1/config`: Dynamic system configuration (Supabase keys)

### Database & Storage
- **Primary DB:** PostgreSQL (via Supabase)
- **ORM:** Drizzle ORM
- **Storage:** Supabase Storage for report exports
- **Schema:** Strict typing via `db/schema.ts`

### Security & Governance
- **Authentication:** Supabase Auth (JWT based)
- **Authorization:** Supabase RLS (Row Level Security) - Role-based access (Executive vs. Manager)
- **Validation:** Zod schemas for API payloads and data ingestion
- **Rate Limiting:** `express-rate-limit` (100 requests per 15 min per IP)

### Performance & Scaling
- **Caching:** 
    - **Server:** Redis-ready cache layer (`api/cache.js`)
    - **Client:** Binary indexing via `ChronologicalIndexer` (O(log N) lookups)
- **Monitoring:** 
    - **Observability:** Prometheus + Grafana (Visualisation) + **Thanos** (Long-term metric retention)
    - **Uptime:** Postamus integration
- **Review:** **CodeRabbit** integrated for AI-driven PR reviews and security auditing

### Operations (DevOps)
- **CI/CD:** GitHub Actions (Lint -> Type-check -> Build -> Playwright E2E -> Deploy)
- **Backups:** Daily automated Supabase PG backups
- **Disaster Recovery:** Multi-region deployment ready (Vercel + Supabase)
- **Logging:** Structured JSON logging (`api/logger.js`)

## 3. Data Strategy
- **JSON Migration:** The project is transitioning from CSV/Sheet sources to a **PostgreSQL JSONB** approach for semi-structured transaction data. This allows for dynamic SKU attributes without schema migrations.
- **Audit Trail:** Every authenticated state change and data export is logged to a `security_audit` table.

## 4. Professional Mandates
- **No Mock Data:** The application must fail explicitly rather than falling back to mock data in production.
- **A11y:** Full keyboard navigation support and ARIA compliance.
- **Parity:** Ensure `data-logic.ts` and `public/data-logic.js` remain bit-identical.
