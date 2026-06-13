-- 001_revenue_indexes.sql
-- public.revenue had NO indexes, so every filtered/date-range/aggregation query
-- (including /api/revenue/summary) did a full table scan. These indexes back the
-- date-range and segment filters that every dashboard query uses, and set up the
-- server-side SQL aggregation (Phase 2). Idempotent — safe to re-run.

CREATE INDEX IF NOT EXISTS ix_revenue_invoice_date ON public.revenue ("Invoice date");
CREATE INDEX IF NOT EXISTS ix_revenue_segment      ON public.revenue ("Segment");
