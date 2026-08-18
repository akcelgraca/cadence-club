-- Migration 024: Expand activity types to 35+ activities across 8 categories
-- Updates CHECK constraints on activities.type, training_plans.activity_type, and routes.activity_type

-- ============================================================
-- 1. activities.type constraint
-- ============================================================
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey)
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'activities'
      AND a.attname = 'type'
      AND c.contype = 'c'
      AND a.attrelid = t.oid;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE activities DROP CONSTRAINT %I', constraint_name);
    END IF;

    EXECUTE format('ALTER TABLE activities ADD CONSTRAINT %I CHECK (type IN (
        ''run'', ''trail_run'', ''stroll'', ''walk'', ''wheelchair'',
        ''cycle'', ''ebike'', ''mtb'',
        ''weight_training'', ''workout'', ''hiit'', ''crossfit'', ''physiotherapy'',
        ''tennis'', ''padel'', ''squash'', ''badminton'', ''table_tennis'',
        ''swimming'', ''surf'', ''stand_up_paddle'', ''kayak'', ''rowing'', ''canoeing'', ''sailing'',
        ''ice_skating'', ''snowboard'', ''alpine_skiing'',
        ''football'', ''basketball'', ''volleyball'', ''futsal'',
        ''yoga'', ''dance'', ''skateboard'', ''pilates''
    ))',
        COALESCE(constraint_name, 'activities_type_check'));
END $$;

-- ============================================================
-- 2. training_plans.activity_type constraint (includes 'rest')
-- ============================================================
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey)
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'training_plans'
      AND a.attname = 'activity_type'
      AND c.contype = 'c'
      AND a.attrelid = t.oid;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE training_plans DROP CONSTRAINT %I', constraint_name);
    END IF;

    EXECUTE format('ALTER TABLE training_plans ADD CONSTRAINT %I CHECK (activity_type IN (
        ''rest'',
        ''run'', ''trail_run'', ''stroll'', ''walk'', ''wheelchair'',
        ''cycle'', ''ebike'', ''mtb'',
        ''weight_training'', ''workout'', ''hiit'', ''crossfit'', ''physiotherapy'',
        ''tennis'', ''padel'', ''squash'', ''badminton'', ''table_tennis'',
        ''swimming'', ''surf'', ''stand_up_paddle'', ''kayak'', ''rowing'', ''canoeing'', ''sailing'',
        ''ice_skating'', ''snowboard'', ''alpine_skiing'',
        ''football'', ''basketball'', ''volleyball'', ''futsal'',
        ''yoga'', ''dance'', ''skateboard'', ''pilates''
    ))',
        COALESCE(constraint_name, 'training_plans_activity_type_check'));
END $$;

-- ============================================================
-- 3. routes.activity_type constraint
-- ============================================================
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey)
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'routes'
      AND a.attname = 'activity_type'
      AND c.contype = 'c'
      AND a.attrelid = t.oid;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE routes DROP CONSTRAINT %I', constraint_name);
    END IF;

    EXECUTE format('ALTER TABLE routes ADD CONSTRAINT %I CHECK (activity_type IN (
        ''run'', ''trail_run'', ''stroll'', ''walk'', ''wheelchair'',
        ''cycle'', ''ebike'', ''mtb'',
        ''weight_training'', ''workout'', ''hiit'', ''crossfit'', ''physiotherapy'',
        ''tennis'', ''padel'', ''squash'', ''badminton'', ''table_tennis'',
        ''swimming'', ''surf'', ''stand_up_paddle'', ''kayak'', ''rowing'', ''canoeing'', ''sailing'',
        ''ice_skating'', ''snowboard'', ''alpine_skiing'',
        ''football'', ''basketball'', ''volleyball'', ''futsal'',
        ''yoga'', ''dance'', ''skateboard'', ''pilates''
    ))',
        COALESCE(constraint_name, 'routes_activity_type_check'));
END $$;
