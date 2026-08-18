-- Migration 019: Add questionnaire preference columns to profiles
-- Allows storing user training preferences from the onboarding/registration questionnaire

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS available_days INTEGER[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS preferred_activities TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS session_duration TEXT DEFAULT NULL
  CHECK (session_duration IS NULL OR session_duration IN ('short', 'medium', 'long')),
ADD COLUMN IF NOT EXISTS fitness_level TEXT DEFAULT NULL
  CHECK (fitness_level IS NULL OR fitness_level IN ('beginner', 'intermediate', 'advanced')),
ADD COLUMN IF NOT EXISTS has_completed_questionnaire BOOLEAN DEFAULT FALSE;
