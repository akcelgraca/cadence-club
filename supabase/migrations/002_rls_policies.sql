-- ============================================================
-- 002_rls_policies.sql
-- Row Level Security policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Profiles
-- ============================================================
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (true);  -- Anyone can read profiles

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- Activities
-- ============================================================
CREATE POLICY "activities_select" ON public.activities
  FOR SELECT USING (
    is_public = true
    OR user_id = auth.uid()
    OR user_id IN (
      SELECT following_id FROM public.follows WHERE follower_id = auth.uid()
    )
  );

CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activities_update" ON public.activities
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "activities_delete" ON public.activities
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Activity Points
-- ============================================================
CREATE POLICY "activity_points_select" ON public.activity_points
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.activities
      WHERE id = activity_id
      AND (is_public = true OR user_id = auth.uid()
           OR user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid()))
    )
  );

CREATE POLICY "activity_points_insert" ON public.activity_points
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activities
      WHERE id = activity_id AND user_id = auth.uid()
    )
  );

-- ============================================================
-- Follows
-- ============================================================
CREATE POLICY "follows_select" ON public.follows
  FOR SELECT USING (true);

CREATE POLICY "follows_insert" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ============================================================
-- Kudos
-- ============================================================
CREATE POLICY "kudos_select" ON public.kudos
  FOR SELECT USING (true);

CREATE POLICY "kudos_insert" ON public.kudos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kudos_delete" ON public.kudos
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Comments
-- ============================================================
CREATE POLICY "comments_select" ON public.comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.activities
      WHERE id = activity_id
      AND (is_public = true OR user_id = auth.uid()
           OR user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid()))
    )
  );

CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_delete" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Notifications
-- ============================================================
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- Streaks
-- ============================================================
CREATE POLICY "streaks_select" ON public.streaks
  FOR SELECT USING (true);

-- Streaks are managed by triggers, no direct insert/update by users

-- ============================================================
-- Badges (read-only catalog)
-- ============================================================
CREATE POLICY "badges_select" ON public.badges
  FOR SELECT USING (true);

-- ============================================================
-- User Badges
-- ============================================================
CREATE POLICY "user_badges_select" ON public.user_badges
  FOR SELECT USING (true);

-- User badges managed by triggers

-- ============================================================
-- Challenges
-- ============================================================
CREATE POLICY "challenges_select" ON public.challenges
  FOR SELECT USING (true);

CREATE POLICY "user_challenges_select" ON public.user_challenges
  FOR SELECT USING (true);

CREATE POLICY "user_challenges_insert" ON public.user_challenges
  FOR INSERT WITH CHECK (auth.uid() = user_id);
