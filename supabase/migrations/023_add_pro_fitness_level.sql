-- Migration 023: Add 'pro' to fitness_level CHECK constraint
-- Expands the fitness_level enum to include a 'pro' option for high-performance athletes

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the auto-generated constraint name for the fitness_level CHECK
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey)


    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'profiles'
      AND a.attname = 'fitness_level'
      AND c.contype = 'c'
      AND a.attrelid = t.oid;

    IF constraint_name IS NOT NULL THEN
        -- Drop the existing constraint
        EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', constraint_name);
    END IF;

    -- Add the new constraint with 'pro' included
    EXECUTE format('ALTER TABLE profiles ADD CONSTRAINT %I CHECK (fitness_level IS NULL OR fitness_level IN (''beginner'', ''intermediate'', ''advanced'', ''pro''))',
        COALESCE(constraint_name, 'profiles_fitness_level_check'));
END $$;
