-- 036_events_and_club_profile.sql
-- Eventos dos clubes, estatísticas do clube, chats de clube na aba Mensagens
-- e progresso de desafios (tabelas challenges/user_challenges já existiam desde
-- a 001 mas nunca tinham sido usadas).

-- ── Helper: sou membro deste clube? ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_club_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid) TO authenticated;

-- ── Eventos ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.club_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description   text,
  activity_type text,
  location      text,
  starts_at     timestamptz NOT NULL,
  distance      real,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_events_club_starts_idx ON public.club_events(club_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS club_events_starts_idx      ON public.club_events(starts_at);

ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;

-- Eventos de clubes públicos são visíveis a todos; de privados só a membros
CREATE POLICY "club_events_select" ON public.club_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.is_private = false)
    OR public.is_club_member(club_id)
  );

CREATE POLICY "club_events_insert" ON public.club_events
  FOR INSERT WITH CHECK (auth.uid() = created_by AND public.is_club_admin(club_id));

CREATE POLICY "club_events_update" ON public.club_events
  FOR UPDATE USING (auth.uid() = created_by OR public.is_club_admin(club_id));

CREATE POLICY "club_events_delete" ON public.club_events
  FOR DELETE USING (auth.uid() = created_by OR public.is_club_admin(club_id));

-- ── Participações (RSVP) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_attendees (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     text        NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_attendees_event_idx ON public.event_attendees(event_id);

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_attendees_select" ON public.event_attendees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.club_events e
      JOIN public.clubs c ON c.id = e.club_id
      WHERE e.id = event_id
        AND (c.is_private = false OR public.is_club_member(c.id))
    )
  );

CREATE POLICY "event_attendees_insert" ON public.event_attendees
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.club_events e
      WHERE e.id = event_id AND public.is_club_member(e.club_id)
    )
  );

CREATE POLICY "event_attendees_update" ON public.event_attendees
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "event_attendees_delete" ON public.event_attendees
  FOR DELETE USING (auth.uid() = user_id);

-- ── Estatísticas do clube ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_club_stats(p_club_id uuid)
RETURNS TABLE (
  total_activities  int,
  total_distance    real,
  month_distance    real,
  active_members    int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(count(a.id), 0)::int,
    COALESCE(sum(a.distance), 0)::real,
    COALESCE(sum(a.distance) FILTER (WHERE a.start_time >= date_trunc('month', now())), 0)::real,
    COALESCE(count(DISTINCT a.user_id) FILTER (WHERE a.start_time >= now() - interval '30 days'), 0)::int
  FROM public.club_members m
  LEFT JOIN public.activities a
    ON a.user_id = m.user_id AND a.is_public = true
  WHERE m.club_id = p_club_id;
$$;

REVOKE ALL ON FUNCTION public.get_club_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_club_stats(uuid) TO authenticated;

-- ── Chats de clube para a aba Mensagens ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_club_chats()
RETURNS TABLE (
  club_id           uuid,
  name              text,
  avatar_url        text,
  last_message_body text,
  last_message_at   timestamptz,
  unread_count      int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.avatar_url,
    last_msg.body,
    last_msg.created_at,
    COALESCE((
      SELECT count(*)::int
      FROM public.club_messages cm
      WHERE cm.club_id = c.id
        AND cm.user_id <> auth.uid()
        AND cm.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
    ), 0)
  FROM public.club_members m
  JOIN public.clubs c ON c.id = m.club_id
  LEFT JOIN public.club_reads r ON r.club_id = c.id AND r.user_id = auth.uid()
  LEFT JOIN LATERAL (
    SELECT cm.body, cm.created_at
    FROM public.club_messages cm
    WHERE cm.club_id = c.id
    ORDER BY cm.created_at DESC
    LIMIT 1
  ) last_msg ON true
  WHERE m.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_club_chats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_club_chats() TO authenticated;

-- ── Desafios: progresso individual e coletivo ────────────────────────────────
-- type: 'distance' (metros) | 'duration' (segundos) | 'count' (atividades)
--       | 'elevation' (metros)

CREATE POLICY "user_challenges_update" ON public.user_challenges
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_challenges_delete" ON public.user_challenges
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_challenges_with_progress()
RETURNS TABLE (
  id                 uuid,
  name               text,
  description        text,
  type               text,
  goal               real,
  start_date         date,
  end_date           date,
  participants       int,
  joined             boolean,
  my_progress        real,
  community_progress real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH progress AS (
    SELECT
      ch.id AS challenge_id,
      uc.user_id,
      CASE ch.type
        WHEN 'distance'  THEN COALESCE(sum(a.distance), 0)
        WHEN 'duration'  THEN COALESCE(sum(a.duration), 0)
        WHEN 'elevation' THEN COALESCE(sum(a.elevation_gain), 0)
        ELSE COALESCE(count(a.id), 0)
      END::real AS value
    FROM public.challenges ch
    JOIN public.user_challenges uc ON uc.challenge_id = ch.id
    LEFT JOIN public.activities a
      ON a.user_id = uc.user_id
     AND a.start_time >= ch.start_date::timestamptz
     AND a.start_time <  (ch.end_date + 1)::timestamptz
    GROUP BY ch.id, ch.type, uc.user_id
  )
  SELECT
    ch.id, ch.name, ch.description, ch.type, ch.goal, ch.start_date, ch.end_date,
    COALESCE((SELECT count(*)::int FROM public.user_challenges u WHERE u.challenge_id = ch.id), 0),
    EXISTS (SELECT 1 FROM public.user_challenges u WHERE u.challenge_id = ch.id AND u.user_id = auth.uid()),
    COALESCE((SELECT p.value FROM progress p WHERE p.challenge_id = ch.id AND p.user_id = auth.uid()), 0)::real,
    COALESCE((SELECT sum(p.value) FROM progress p WHERE p.challenge_id = ch.id), 0)::real
  FROM public.challenges ch
  ORDER BY (ch.end_date >= current_date) DESC, ch.end_date ASC;
$$;

REVOKE ALL ON FUNCTION public.get_challenges_with_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_challenges_with_progress() TO authenticated;

-- ── Desafios de arranque (comunidade) ────────────────────────────────────────
-- Metas coletivas, sem competição direta — alinhado com o posicionamento.

INSERT INTO public.challenges (name, description, type, goal, start_date, end_date)
SELECT * FROM (VALUES
  (
    'Desafio do Mês — 100 km',
    'Soma 100 km de qualquer atividade este mês. Sem pressão, sem rankings — só consistência.',
    'distance',
    100000::real,
    date_trunc('month', current_date)::date,
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date
  ),
  (
    'Meta da Comunidade — 1000 km',
    'Juntos somamos 1000 km este mês. Cada quilómetro teu conta para o total da comunidade.',
    'distance',
    1000000::real,
    date_trunc('month', current_date)::date,
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date
  ),
  (
    '12 Treinos no Mês',
    'Três treinos por semana, doze no mês. O objetivo é o hábito, não o cronómetro.',
    'count',
    12::real,
    date_trunc('month', current_date)::date,
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date
  )
) AS seed(name, description, type, goal, start_date, end_date)
WHERE NOT EXISTS (SELECT 1 FROM public.challenges);
