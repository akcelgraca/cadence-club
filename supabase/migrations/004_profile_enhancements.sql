-- ============================================================
-- 004_profile_enhancements.sql
-- Enhanced profile fields, equipment tracking, stats RPCs,
-- and activity_id on user_badges
-- ============================================================

-- ============================================================
-- 1A. New columns on profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS weight_kg REAL,
  ADD COLUMN IF NOT EXISTS main_sport TEXT CHECK (main_sport IN ('run', 'cycle', 'walk', 'multi'));

-- ============================================================
-- 1B. Add activity_id to user_badges
-- ============================================================
ALTER TABLE public.user_badges
  ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL;

-- ============================================================
-- 1C. New equipment table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('bike', 'shoes', 'other')),
  brand TEXT,
  model TEXT,
  notes TEXT,
  initial_distance REAL DEFAULT 0,
  is_retired BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_user ON public.equipment(user_id);

-- RLS for equipment
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own equipment"
  ON public.equipment FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own equipment"
  ON public.equipment FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own equipment"
  ON public.equipment FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own equipment"
  ON public.equipment FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 1D. Stats RPC functions
-- ============================================================

-- Weekly summary (Mon-Sun of the current week)
CREATE OR REPLACE FUNCTION get_weekly_summary(p_user_id UUID)
RETURNS TABLE(
  total_distance REAL,
  total_duration REAL,
  total_elevation REAL,
  activity_count BIGINT
) AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
BEGIN
  v_week_start := date_trunc('week', NOW()::DATE)::DATE;
  v_week_end := v_week_start + 6;

  RETURN QUERY
  SELECT
    COALESCE(SUM(a.distance), 0)::REAL,
    COALESCE(SUM(a.duration), 0)::REAL,
    COALESCE(SUM(a.elevation_gain), 0)::REAL,
    COUNT(a.id)
  FROM public.activities a
  WHERE a.user_id = p_user_id
    AND a.start_time::DATE >= v_week_start
    AND a.start_time::DATE <= v_week_end;
END;
$$ LANGUAGE plpgsql;

-- Monthly stats for last N months
CREATE OR REPLACE FUNCTION get_monthly_stats(p_user_id UUID, p_months INTEGER DEFAULT 12)
RETURNS TABLE(
  month_year TEXT,
  total_distance REAL,
  total_duration REAL,
  total_elevation REAL,
  activity_count BIGINT
) AS $$
DECLARE
  v_start_date DATE;
BEGIN
  v_start_date := (date_trunc('month', NOW()::DATE) - (p_months - 1 || ' months')::INTERVAL)::DATE;

  RETURN QUERY
  SELECT
    to_char(a.start_time::DATE, 'YYYY-MM') AS month_year,
    COALESCE(SUM(a.distance), 0)::REAL,
    COALESCE(SUM(a.duration), 0)::REAL,
    COALESCE(SUM(a.elevation_gain), 0)::REAL,
    COUNT(a.id)
  FROM public.activities a
  WHERE a.user_id = p_user_id
    AND a.start_time::DATE >= v_start_date
  GROUP BY month_year
  ORDER BY month_year;
END;
$$ LANGUAGE plpgsql;

-- All-time profile stats
CREATE OR REPLACE FUNCTION get_profile_stats(p_user_id UUID)
RETURNS TABLE(
  total_distance REAL,
  total_duration REAL,
  total_elevation REAL,
  activity_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(a.distance), 0)::REAL,
    COALESCE(SUM(a.duration), 0)::REAL,
    COALESCE(SUM(a.elevation_gain), 0)::REAL,
    COUNT(a.id)
  FROM public.activities a
  WHERE a.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Update trigger functions to include activity_id
-- ============================================================

-- Recreate check_and_award_badges to pass activity_id to all inserts
CREATE OR REPLACE FUNCTION check_and_award_badges(p_user_id UUID, p_activity_id UUID)
RETURNS void AS $$
DECLARE
  v_activity public.activities;
  v_activity_count INTEGER;
  v_distance_5k BOOLEAN;
  v_distance_10k BOOLEAN;
  v_climb_100m BOOLEAN;
  v_hour INTEGER;
  v_dow INTEGER;
  v_kudo_count INTEGER;
  v_distinct_types INTEGER;
BEGIN
  SELECT * INTO v_activity FROM public.activities WHERE id = p_activity_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- First activity badge
  SELECT COUNT(*) INTO v_activity_count FROM public.activities WHERE user_id = p_user_id;
  IF v_activity_count = 1 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'first_activity', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Distance badges
  IF v_activity.distance >= 5000 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'distance_5k', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_activity.distance >= 10000 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'distance_10k', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_activity.distance >= 21098 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'distance_21k', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Elevation badge
  IF v_activity.elevation_gain >= 100 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'climb_100m', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Time-based badges
  v_hour := EXTRACT(HOUR FROM v_activity.start_time);
  IF v_hour < 7 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'early_bird', p_activity_id)
    ON CONFLICT DO NOTHING;
  ELSIF v_hour >= 22 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'night_owl', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Weekend warrior
  v_dow := EXTRACT(DOW FROM v_activity.start_time);
  IF v_dow IN (0, 6) THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'weekend_warrior', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Multi-sport badge
  SELECT COUNT(DISTINCT type) INTO v_distinct_types FROM public.activities WHERE user_id = p_user_id;
  IF v_distinct_types >= 3 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'multi_sport', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Social kudos badge (check if activity has 5+ kudos)
  SELECT COUNT(*) INTO v_kudo_count FROM public.kudos WHERE activity_id = p_activity_id;
  IF v_kudo_count >= 5 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'social_5_kudos', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Streak badges
  PERFORM check_streak_badges(p_user_id, p_activity_id);
END;
$$ LANGUAGE plpgsql;

-- Recreate check_streak_badges to accept activity_id
CREATE OR REPLACE FUNCTION check_streak_badges(p_user_id UUID, p_activity_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_current_streak INTEGER;
BEGIN
  SELECT current_streak INTO v_current_streak FROM public.streaks WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_current_streak >= 3 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'streak_3', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_current_streak >= 7 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'streak_7', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_current_streak >= 30 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'streak_30', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update after_kudo_insert to use activity_id
CREATE OR REPLACE FUNCTION after_kudo_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_user_id UUID;
  v_kudo_count INTEGER;
BEGIN
  SELECT user_id INTO v_activity_user_id FROM public.activities WHERE id = NEW.activity_id;
  SELECT COUNT(*) INTO v_kudo_count FROM public.kudos WHERE activity_id = NEW.activity_id;

  IF v_kudo_count >= 5 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (v_activity_user_id, 'social_5_kudos', NEW.activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
