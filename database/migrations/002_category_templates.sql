-- ============================================================
-- Migration: Category mini-website templates — shared foundation
-- Run this in the Supabase SQL editor on your EXISTING database.
-- (schema.sql has also been updated so future fresh installs include
-- this automatically — this file is only needed for databases that
-- already ran the original schema.sql.)
--
-- IMPORTANT: run this as TWO separate queries, in this order. Postgres
-- won't let a new enum value be used in the same transaction/query that
-- adds it, so the ALTER TYPE statement must be run and committed on its
-- own before anything below it that could touch 'before'/'after' media.
-- ============================================================

-- ── STEP 1: run this query first, by itself ────────────────────────────
ALTER TYPE media_type ADD VALUE IF NOT EXISTS 'before';
ALTER TYPE media_type ADD VALUE IF NOT EXISTS 'after';
