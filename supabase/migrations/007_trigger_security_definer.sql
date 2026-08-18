-- ============================================================
-- 007_trigger_security_definer.sql
-- Fix: trigger functions must be SECURITY DEFINER to bypass RLS
-- on tables managed by triggers (streaks, user_badges)
-- ============================================================

-- These functions run in AFTER INSERT triggers and need to
-- INSERT/UPDATE on streaks and user_badges, which have no user
-- RLS policies (they're "managed by triggers")

-- Streak functions
CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID, p_activity_date DATE)
RETURNS void
SECURITY DEFINER
AS $$
DECLARE
  v_streak public.streaks;
  v_diff INTEGER;
BEGIN
  SELECT * INTO v_streak FROM public.streaks WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (p_user_id, 1, 1, p_activity_date);
  ELSE
    v_diff := p_activity_date - v_streak.last_activity_date;

    IF v_diff = 1 THEN
      UPDATE public.streaks
      SET current_streak = current_streak + 1,
          longest_streak = GREATEST(longest_streak, current_streak + 1),
          last_activity_date = p_activity_date,
          updated_at = NOW()
      WHERE user_id = p_user_id;
    ELSIF v_diff = 0 THEN
      UPDATE public.streaks
      SET last_activity_date = p_activity_date, updated_at = NOW()
      WHERE user_id = p_user_id;
    ELSE
      UPDATE public.streaks
      SET current_streak = 1,
          last_activity_date = p_activity_date,
          updated_at = NOW()
      WHERE user_id = p_user_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Check streak badges
CREATE OR REPLACE FUNCTION check_streak_badges(p_user_id UUID)
RETURNS void
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak INTEGER;
BEGIN
  SELECT current_streak INTO v_current_streak FROM public.streaks WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_current_streak >= 3 THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'streak_3')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_current_streak >= 7 THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'streak_7')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_current_streak >= 30 THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'streak_30')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Check and award badges
CREATE OR REPLACE FUNCTION check_and_award_badges(p_user_id UUID, p_activity_id UUID)
RETURNS void
SECURITY DEFINER
AS $$
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

  -- Social kudos badge
  SELECT COUNT(*) INTO v_kudo_count FROM public.kudos WHERE activity_id = p_activity_id;
  IF v_kudo_count >= 5 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (p_user_id, 'social_5_kudos', p_activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Streak badges
  PERFORM check_streak_badges(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- After activity insert trigger function
CREATE OR REPLACE FUNCTION after_activity_insert()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  PERFORM update_streak(NEW.user_id, NEW.start_time::DATE);
  PERFORM check_and_award_badges(NEW.user_id, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- After kudo insert trigger function
CREATE OR REPLACE FUNCTION after_kudo_insert()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
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
