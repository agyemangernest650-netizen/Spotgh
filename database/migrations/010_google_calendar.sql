-- ============================================================
-- Migration: Google Calendar sync for bookings
-- Run this in the Supabase SQL editor on your existing database.
-- Safe to run even if already applied (IF NOT EXISTS).
-- ============================================================
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS google_calendar_refresh_token TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS google_calendar_id TEXT DEFAULT 'primary';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS google_event_id TEXT;
