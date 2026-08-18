-- ============================================================
-- 006_training_plans.sql
-- Training plans table - stores weekly training plan per user
-- Users can generate, view and edit their weekly plan
-- ============================================================

CREATE TABLE public.training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('run', 'cycle', 'walk', 'rest')),
  label TEXT NOT NULL,
  target_distance REAL,
  target_duration INTEGER,
  is_completed BOOLEAN DEFAULT false,
  completed_activity_id UUID REFERENCES public.activities(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start, day_of_week)
);

CREATE INDEX idx_training_plans_user_week ON public.training_plans(user_id, week_start);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

-- Users can read their own training plans
CREATE POLICY "Users can read own training plans"
  ON public.training_plans FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own training plans
CREATE POLICY "Users can insert own training plans"
  ON public.training_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own training plans
CREATE POLICY "Users can update own training plans"
  ON public.training_plans FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own training plans
CREATE POLICY "Users can delete own training plans"
  ON public.training_plans FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Trigger: auto-update updated_at
-- ============================================================
CREATE TRIGGER training_plans_updated_at
  BEFORE UPDATE ON public.training_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
