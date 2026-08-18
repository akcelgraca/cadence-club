-- 032_club_reads.sql
-- Última leitura do chat de cada clube — alimenta o badge "Clubes" no menu Social.

CREATE TABLE IF NOT EXISTS public.club_reads (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id      uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, club_id)
);

ALTER TABLE public.club_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_reads_select" ON public.club_reads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "club_reads_insert" ON public.club_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "club_reads_update" ON public.club_reads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "club_reads_delete" ON public.club_reads
  FOR DELETE USING (auth.uid() = user_id);

-- Nº de clubes com mensagens (de outros) mais recentes do que a última leitura.
CREATE OR REPLACE FUNCTION public.get_unread_clubs_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(DISTINCT cm.club_id)::int
  FROM public.club_messages cm
  JOIN public.club_members m
    ON m.club_id = cm.club_id AND m.user_id = auth.uid()
  LEFT JOIN public.club_reads r
    ON r.club_id = cm.club_id AND r.user_id = auth.uid()
  WHERE cm.user_id <> auth.uid()
    AND cm.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz);
$$;

REVOKE ALL ON FUNCTION public.get_unread_clubs_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_clubs_count() TO authenticated;
