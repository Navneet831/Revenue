-- Migration: Move revenue table from public to revenue schema
-- Run this in Supabase SQL Editor to migrate the table

-- 1. Create the revenue schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS revenue;

-- 2. Move the revenue table (and its indexes, constraints, sequences)
ALTER TABLE IF EXISTS public.revenue SET SCHEMA revenue;

-- 3. Ensure the revenue schema is accessible to the postgres and service_role
--    (Supabase RLS handles auth; schema-level permissions are for superuser queries)
GRANT USAGE ON SCHEMA revenue TO postgres, service_role, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA revenue TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA revenue TO authenticated, anon;

-- 4. Set default privileges for future objects in the revenue schema
ALTER DEFAULT PRIVILEGES IN SCHEMA revenue GRANT SELECT ON TABLES TO authenticated, anon;
