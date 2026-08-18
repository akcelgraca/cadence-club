-- Add deeper training preference columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS weekly_frequency SMALLINT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS preferred_time TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS training_focus TEXT DEFAULT NULL;

-- Add check constraints for enum-like fields
ALTER TABLE profiles
ADD CONSTRAINT check_weekly_frequency
  CHECK (weekly_frequency IS NULL OR (weekly_frequency >= 2 AND weekly_frequency <= 7)),
ADD CONSTRAINT check_preferred_time
  CHECK (preferred_time IS NULL OR preferred_time IN ('morning', 'afternoon', 'evening', 'flexible')),
ADD CONSTRAINT check_training_focus
  CHECK (training_focus IS NULL OR training_focus IN ('endurance', 'speed', 'weight_loss', 'general_health', 'race_prep'));

