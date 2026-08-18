-- 031_feed_fixes.sql
-- Correções da área do feed:
--  1. saved_posts — "Guardar post" passava a impressão de guardar mas não persistia nada
--  2. reports — a app inseria numa tabela que não existia (denúncias iam para o vazio)
--  3. realtime em activities — o useFeed subscreve INSERTs mas a tabela não estava na publicação

-- ── 1. Posts guardados ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.saved_posts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_id uuid        NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, activity_id)
);

CREATE INDEX IF NOT EXISTS saved_posts_user_idx ON public.saved_posts(user_id, created_at DESC);

ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_posts_select" ON public.saved_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "saved_posts_insert" ON public.saved_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_posts_delete" ON public.saved_posts
  FOR DELETE USING (auth.uid() = user_id);

-- ── 2. Denúncias ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_id uuid        REFERENCES public.activities(id) ON DELETE SET NULL,
  reason      text        NOT NULL CHECK (reason IN ('inappropriate', 'spam', 'other')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_activity_idx ON public.reports(activity_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Utilizadores criam denúncias em seu nome; só leem as próprias.
-- (A moderação lê via service_role / dashboard.)
CREATE POLICY "reports_insert" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "reports_select" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- ── 3. Realtime do feed ──────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
