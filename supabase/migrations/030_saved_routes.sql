-- 030_saved_routes.sql
-- Rotas guardadas (favoritos) pelo utilizador — usado na pesquisa global.

CREATE TABLE IF NOT EXISTS public.saved_routes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  route_id   uuid        NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, route_id)
);

CREATE INDEX IF NOT EXISTS saved_routes_user_idx ON public.saved_routes(user_id);

ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_routes_select" ON public.saved_routes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "saved_routes_insert" ON public.saved_routes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_routes_delete" ON public.saved_routes
  FOR DELETE USING (auth.uid() = user_id);
