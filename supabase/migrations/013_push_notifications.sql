-- ============================================================
-- 013_push_notifications.sql
-- Push notifications: expo_push_token column, INSERT policy,
-- and trigger functions that create notification rows when
-- social actions occur (follow, kudo, comment, badge, streak).
-- ============================================================

-- ============================================================
-- 1A. Add expo_push_token column to profiles
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- ============================================================
-- 1B. INSERT policy on notifications
-- ============================================================
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Helper functions
-- ============================================================

-- Return the display name for a given actor (user id).
CREATE OR REPLACE FUNCTION get_actor_display_name(p_actor_id UUID)
RETURNS TEXT
SECURITY DEFINER
AS $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT full_name INTO v_name FROM public.profiles WHERE id = p_actor_id;
  RETURN COALESCE(v_name, 'Alguem');
END;
$$ LANGUAGE plpgsql;

-- Return the human-readable name for a given badge id.
CREATE OR REPLACE FUNCTION get_badge_name(p_badge_id TEXT)
RETURNS TEXT
SECURITY DEFINER
AS $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT name INTO v_name FROM public.badges WHERE id = p_badge_id;
  RETURN COALESCE(v_name, p_badge_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1C. Trigger: follow -> notification
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_actor_name TEXT;
BEGIN
  v_actor_name := get_actor_display_name(NEW.follower_id);

  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message)
  VALUES (NEW.following_id, 'follow', NEW.follower_id, NEW.follower_id,
          v_actor_name || ' comecou a seguir-te!');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_on_follow ON public.follows;
CREATE TRIGGER trigger_notify_on_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_follow();

-- ============================================================
-- 1D. Extend after_kudo_insert -> also create notification
-- ============================================================

-- Drop dependent trigger first
DROP TRIGGER IF EXISTS trigger_after_kudo_insert ON public.kudos;

-- Recreate the function with notification logic added
CREATE OR REPLACE FUNCTION after_kudo_insert()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_activity_user_id UUID;
  v_kudo_count INTEGER;
  v_actor_name TEXT;
BEGIN
  SELECT user_id INTO v_activity_user_id FROM public.activities WHERE id = NEW.activity_id;
  SELECT COUNT(*) INTO v_kudo_count FROM public.kudos WHERE activity_id = NEW.activity_id;

  -- Badge: social_5_kudos
  IF v_kudo_count >= 5 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (v_activity_user_id, 'social_5_kudos', NEW.activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Notification: only if kudo is NOT on own activity
  IF v_activity_user_id IS NOT NULL AND v_activity_user_id <> NEW.user_id THEN
    v_actor_name := get_actor_display_name(NEW.user_id);
    INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message)
    VALUES (v_activity_user_id, 'kudo', NEW.user_id, NEW.activity_id,
            v_actor_name || ' deu-te um boost!');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_after_kudo_insert
  AFTER INSERT ON public.kudos
  FOR EACH ROW
  EXECUTE FUNCTION after_kudo_insert();

-- ============================================================
-- 1E. Trigger: comment -> notification
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_activity_user_id UUID;
  v_actor_name TEXT;
BEGIN
  SELECT user_id INTO v_activity_user_id FROM public.activities WHERE id = NEW.activity_id;

  -- Only notify if comment is NOT on own activity
  IF v_activity_user_id IS NOT NULL AND v_activity_user_id <> NEW.user_id THEN
    v_actor_name := get_actor_display_name(NEW.user_id);
    INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message)
    VALUES (v_activity_user_id, 'comment', NEW.user_id, NEW.activity_id,
            v_actor_name || ' comentou na tua atividade.');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_on_comment ON public.comments;
CREATE TRIGGER trigger_notify_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_comment();

-- ============================================================
-- 1F. Trigger: user_badge -> notification
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_badge_earned()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_badge_name TEXT;
BEGIN
  v_badge_name := get_badge_name(NEW.badge_id);

  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message)
  VALUES (NEW.user_id, 'badge', NULL, NEW.id,
          'Desbloqueaste o cracha: ' || v_badge_name || '!');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_on_badge_earned ON public.user_badges;
CREATE TRIGGER trigger_notify_on_badge_earned
  AFTER INSERT ON public.user_badges
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_badge_earned();

-- ============================================================
-- 1G. Extend update_streak -> streak milestone notifications
--     Milestones: 5, 10, 14, 21, 50, 100 days.
--     Streaks 3, 7, 30 are already covered by badge trigger (1F).
-- ============================================================

DROP TRIGGER IF EXISTS trigger_after_activity_insert ON public.activities;

-- Recreate update_streak with streak notification logic
CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID, p_activity_date DATE)
RETURNS void
SECURITY DEFINER
AS $$
DECLARE
  v_streak public.streaks;
  v_diff INTEGER;
  v_new_streak INTEGER;
  v_milestones INTEGER[] := ARRAY[5, 10, 14, 21, 50, 100];
  v_m INTEGER;
BEGIN
  SELECT * INTO v_streak FROM public.streaks WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (p_user_id, 1, 1, p_activity_date);
    v_new_streak := 1;
  ELSE
    v_diff := p_activity_date - v_streak.last_activity_date;

    IF v_diff = 1 THEN
      UPDATE public.streaks
      SET current_streak = current_streak + 1,
          longest_streak = GREATEST(longest_streak, current_streak + 1),
          last_activity_date = p_activity_date,
          updated_at = NOW()
      WHERE user_id = p_user_id;
      v_new_streak := v_streak.current_streak + 1;
    ELSIF v_diff = 0 THEN
      UPDATE public.streaks
      SET last_activity_date = p_activity_date, updated_at = NOW()
      WHERE user_id = p_user_id;
      v_new_streak := v_streak.current_streak;
    ELSE
      UPDATE public.streaks
      SET current_streak = 1,
          last_activity_date = p_activity_date,
          updated_at = NOW()
      WHERE user_id = p_user_id;
      v_new_streak := 1;
    END IF;
  END IF;

  -- Notify on streak milestones (5, 10, 14, 21, 50, 100)
  FOREACH v_m IN ARRAY v_milestones
  LOOP
    IF v_new_streak = v_m THEN
      INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message)
      VALUES (p_user_id, 'streak', NULL, NULL,
              v_m || ' dias de sequencia! Continua assim!');
      EXIT; -- Only one milestone per day
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Recreate after_activity_insert (unchanged logic, just re-bind trigger)
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

-- Recreate the trigger
CREATE TRIGGER trigger_after_activity_insert
  AFTER INSERT ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION after_activity_insert();
