-- Add questionnaire preference columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS available_days INTEGER[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS preferred_activities TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS session_duration TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fitness_level TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS has_completed_questionnaire BOOLEAN DEFAULT FALSE;

-- Add check constraints for enum-like fields
ALTER TABLE profiles
ADD CONSTRAINT check_session_duration
  CHECK (session_duration IS NULL OR session_duration IN ('short', 'medium', 'long')),
ADD CONSTRAINT check_fitness_level
  CHECK (fitness_level IS NULL OR fitness_level IN ('beginner', 'intermediate', 'advanced'));
