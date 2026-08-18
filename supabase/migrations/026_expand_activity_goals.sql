-- Migration 026: Expand activity goals & add weekly_km_target
-- Replaces run_5k with 9 new goals, adds weekly_km_target column to profiles

-- ============================================================
-- 1. Drop existing goal CHECK constraint on profiles
-- ============================================================
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey)
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'profiles'
      AND a.attname = 'goal'
      AND c.contype = 'c'
      AND a.attrelid = t.oid;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- ============================================================
-- 2. Migrate existing run_5k -> run_weekly_km (default 5 km target)
-- ============================================================
UPDATE profiles SET goal = 'run_weekly_km' WHERE goal = 'run_5k';

-- ============================================================
-- 3. Add weekly_km_target column to profiles
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_km_target REAL;

-- ============================================================
-- 4. Recreate CHECK constraint with all new goal values
-- ============================================================
ALTER TABLE profiles ADD CONSTRAINT profiles_goal_check CHECK (goal IN (
    'stay_active',
    'run_weekly_km',
    'cycle_weekly_km',
    'lose_weight',
    'gain_muscle',
    'improve_endurance',
    'train_for_race',
    'train_with_friends',
    'improve_flexibility',
    'improve_technique',
    'explore_outdoors',
    'have_fun'
));

-- ============================================================
-- 5. Drop & recreate training_focus CHECK constraint with new values
-- ============================================================
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey)
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'profiles'
      AND a.attname = 'training_focus'
      AND c.contype = 'c'
      AND a.attrelid = t.oid;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', constraint_name);
    END IF;

    EXECUTE format('ALTER TABLE profiles ADD CONSTRAINT %I CHECK (training_focus IS NULL OR training_focus IN (
        ''endurance'', ''speed'', ''weight_loss'', ''general_health'', ''race_prep'',
        ''strength'', ''flexibility'', ''technique'', ''outdoors'', ''fun''
    ))',
        COALESCE(constraint_name, 'profiles_training_focus_check'));
END $$;
