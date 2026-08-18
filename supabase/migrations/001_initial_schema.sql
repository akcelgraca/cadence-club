-- ============================================================
-- 001_initial_schema.sql
-- Tabelas principais do Fitness Social
-- ============================================================

-- Enable PostGIS extension for geospatial data
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- Profiles (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  goal TEXT CHECK (goal IN ('stay_active', 'run_5k', 'lose_weight', 'train_with_friends')),
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Activities
-- ============================================================
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('run', 'cycle', 'walk')),
  state TEXT NOT NULL DEFAULT 'finished' CHECK (state IN ('idle', 'countdown', 'recording', 'paused', 'finished')),
  distance REAL NOT NULL DEFAULT 0,           -- meters
  duration REAL NOT NULL DEFAULT 0,            -- seconds
  elevation_gain REAL NOT NULL DEFAULT 0,      -- meters
  avg_pace REAL,                               -- seconds/km
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  route_summary JSONB,                         -- [[lat, lng], ...] summarized route
  mood SMALLINT CHECK (mood >= 1 AND mood <= 5),
  title TEXT,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  source TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'healthkit', 'healthconnect')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for feed queries
CREATE INDEX idx_activities_user_created ON public.activities(user_id, created_at DESC);
CREATE INDEX idx_activities_public_feed ON public.activities(is_public, created_at DESC) WHERE is_public = true;

-- ============================================================
-- Activity Points (GPS data)
-- ============================================================
CREATE TABLE public.activity_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  elevation REAL,
  timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_activity_points_activity ON public.activity_points(activity_id, timestamp);

-- ============================================================
-- Follows
-- ============================================================
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

-- ============================================================
-- Kudos
-- ============================================================
CREATE TABLE public.kudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

CREATE INDEX idx_kudos_activity ON public.kudos(activity_id);

-- ============================================================
-- Comments
-- ============================================================
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_activity ON public.comments(activity_id, created_at);

-- ============================================================
-- Notifications
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('kudo', 'comment', 'follow', 'streak', 'badge')),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reference_id UUID,  -- ID of the activity/comment/badge
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- ============================================================
-- Streaks
-- ============================================================
CREATE TABLE public.streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Badges Catalog
-- ============================================================
CREATE TABLE public.badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏅',
  category TEXT NOT NULL CHECK (category IN ('activity', 'distance', 'social', 'special', 'multi_sport')),
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  conditions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- User Badges
-- ============================================================
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON public.user_badges(user_id);

-- ============================================================
-- Challenges (for future phase)
-- ============================================================
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'distance',
  goal REAL NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  progress REAL NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, challenge_id)
);

-- ============================================================
-- Auto-update profiles.updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Streak update function (atomic, no race conditions)
-- ============================================================
CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID, p_activity_date DATE)
RETURNS void AS $$
DECLARE
  v_streak public.streaks;
  v_diff INTEGER;
BEGIN
  SELECT * INTO v_streak FROM public.streaks WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- First streak entry
    INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (p_user_id, 1, 1, p_activity_date);
  ELSE
    -- Calculate day difference
    v_diff := p_activity_date - v_streak.last_activity_date;

    IF v_diff = 1 THEN
      -- Consecutive day: increment streak
      UPDATE public.streaks
      SET current_streak = current_streak + 1,
          longest_streak = GREATEST(longest_streak, current_streak + 1),
          last_activity_date = p_activity_date,
          updated_at = NOW()
      WHERE user_id = p_user_id;
    ELSIF v_diff = 0 THEN
      -- Same day: just update date, no streak change
      UPDATE public.streaks
      SET last_activity_date = p_activity_date, updated_at = NOW()
      WHERE user_id = p_user_id;
    ELSE
      -- Gap > 1 day: reset current streak
      UPDATE public.streaks
      SET current_streak = 1,
          last_activity_date = p_activity_date,
          updated_at = NOW()
      WHERE user_id = p_user_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Check and award badge function
-- ============================================================
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
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'first_activity')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Distance badges
  IF v_activity.distance >= 5000 THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'distance_5k')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_activity.distance >= 10000 THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'distance_10k')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_activity.distance >= 21098 THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'distance_21k')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Elevation badge
  IF v_activity.elevation_gain >= 100 THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'climb_100m')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Time-based badges
  v_hour := EXTRACT(HOUR FROM v_activity.start_time);
  IF v_hour < 7 THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'early_bird')
    ON CONFLICT DO NOTHING;
  ELSIF v_hour >= 22 THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'night_owl')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Weekend warrior
  v_dow := EXTRACT(DOW FROM v_activity.start_time);
  IF v_dow IN (0, 6) THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'weekend_warrior')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Multi-sport badge
  SELECT COUNT(DISTINCT type) INTO v_distinct_types FROM public.activities WHERE user_id = p_user_id;
  IF v_distinct_types >= 3 THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'multi_sport')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Social kudos badge (check if activity has 5+ kudos)
  SELECT COUNT(*) INTO v_kudo_count FROM public.kudos WHERE activity_id = p_activity_id;
  IF v_kudo_count >= 5 THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, 'social_5_kudos')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Streak badges
  PERFORM check_streak_badges(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Check streak badges
-- ============================================================
CREATE OR REPLACE FUNCTION check_streak_badges(p_user_id UUID)
RETURNS void AS $$
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

-- ============================================================
-- Trigger: after activity insert, update streak and check badges
-- ============================================================
CREATE OR REPLACE FUNCTION after_activity_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Update streak
  PERFORM update_streak(NEW.user_id, NEW.start_time::DATE);
  -- Check and award badges
  PERFORM check_and_award_badges(NEW.user_id, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_after_activity_insert
  AFTER INSERT ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION after_activity_insert();

-- ============================================================
-- Trigger: after kudo insert, check social badges
-- ============================================================
CREATE OR REPLACE FUNCTION after_kudo_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_user_id UUID;
  v_kudo_count INTEGER;
BEGIN
  SELECT user_id INTO v_activity_user_id FROM public.activities WHERE id = NEW.activity_id;
  SELECT COUNT(*) INTO v_kudo_count FROM public.kudos WHERE activity_id = NEW.activity_id;

  IF v_kudo_count >= 5 THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (v_activity_user_id, 'social_5_kudos')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_after_kudo_insert
  AFTER INSERT ON public.kudos
  FOR EACH ROW
  EXECUTE FUNCTION after_kudo_insert();
