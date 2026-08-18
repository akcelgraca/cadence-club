-- ============================================================
-- 010_add_phone_to_profiles.sql
-- Add phone column to profiles table
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;
