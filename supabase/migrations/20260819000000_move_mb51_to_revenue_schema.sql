-- Move MB51 table into the revenue schema (prod run once).
ALTER TABLE IF EXISTS public.mb51 SET SCHEMA revenue;
