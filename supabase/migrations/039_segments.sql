-- 039_segments.sql
-- Troços da comunidade.
--
-- Versão cooperativa dos "segmentos": cada troço mostra o TEU histórico e a
-- MÉDIA da comunidade. Não há classificação nem KOM — a app mede consistência,
-- não competição entre pessoas.

-- ── Tabelas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.segments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  name           text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description    text,
  city           text,
  activity_type  text        NOT NULL,
  distance       real        NOT NULL,          -- metros
  elevation_gain real        NOT NULL DEFAULT 0,
  path           geography(LINESTRING, 4326) NOT NULL,
  start_point    geography(POINT, 4326)      NOT NULL,
  end_point      geography(POINT, 4326)      NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS segments_start_gix ON public.segments USING GIST (start_point);
CREATE INDEX IF NOT EXISTS segments_path_gix  ON public.segments USING GIST (path);
CREATE INDEX IF NOT EXISTS segments_type_idx  ON public.segments(activity_type);

CREATE TABLE IF NOT EXISTS public.segment_efforts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id  uuid        NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  activity_id uuid        NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duration    real        NOT NULL,   -- segundos
  pace        real,                   -- segundos por km
  started_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (segment_id, activity_id)
);

CREATE INDEX IF NOT EXISTS segment_efforts_segment_idx ON public.segment_efforts(segment_id);
CREATE INDEX IF NOT EXISTS segment_efforts_user_idx    ON public.segment_efforts(user_id, segment_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.segments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_efforts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "segments_select" ON public.segments FOR SELECT USING (true);

CREATE POLICY "segments_insert" ON public.segments
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "segments_update" ON public.segments
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "segments_delete" ON public.segments
  FOR DELETE USING (auth.uid() = created_by);

-- Os meus registos são sempre visíveis; os de outros só se a atividade
-- de origem for pública — senão expunha treinos privados.
CREATE POLICY "segment_efforts_select" ON public.segment_efforts
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = segment_efforts.activity_id AND a.is_public = true
    )
  );

CREATE POLICY "segment_efforts_delete" ON public.segment_efforts
  FOR DELETE USING (auth.uid() = user_id);

-- ── Criar troço a partir de um pedaço de uma atividade ───────────────────────

CREATE OR REPLACE FUNCTION public.create_segment_from_activity(
  p_activity_id uuid,
  p_name        text,
  p_start_m     real,
  p_end_m       real,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner    uuid;
  v_type     text;
  v_city     text;
  v_line     geometry;
  v_total    real;
  v_sub      geometry;
  v_seg_id   uuid;
  v_elev     real;
BEGIN
  SELECT a.user_id, a.type INTO v_owner, v_type
  FROM public.activities a WHERE a.id = p_activity_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Só podes criar troços a partir das tuas atividades';
  END IF;

  -- Linha da atividade, pela ordem temporal dos pontos
  SELECT ST_SetSRID(ST_MakeLine(ST_MakePoint(p.lng, p.lat) ORDER BY p.timestamp), 4326)
  INTO v_line
  FROM public.activity_points p
  WHERE p.activity_id = p_activity_id;

  IF v_line IS NULL OR ST_NumPoints(v_line) < 2 THEN
    RAISE EXCEPTION 'A atividade não tem pontos de GPS suficientes';
  END IF;

  v_total := ST_Length(v_line::geography);
  IF v_total <= 0 OR p_end_m <= p_start_m THEN
    RAISE EXCEPTION 'Intervalo inválido para o troço';
  END IF;

  -- As frações planares aproximam bem as geodésicas a esta escala
  v_sub := ST_LineSubstring(
    v_line,
    GREATEST(0, LEAST(1, p_start_m / v_total)),
    GREATEST(0, LEAST(1, p_end_m   / v_total))
  );

  -- Subida apenas dos pontos que caem sobre o troço, não da atividade toda
  SELECT COALESCE(SUM(GREATEST(0, d.elev_diff)), 0) INTO v_elev
  FROM (
    SELECT p.elevation - LAG(p.elevation) OVER (ORDER BY p.timestamp) AS elev_diff
    FROM public.activity_points p
    WHERE p.activity_id = p_activity_id
      AND p.elevation IS NOT NULL
      AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
            v_sub::geography, 25)
  ) d;

  SELECT pr.city INTO v_city FROM public.profiles pr WHERE pr.id = v_owner;

  INSERT INTO public.segments (
    created_by, name, description, city, activity_type,
    distance, elevation_gain, path, start_point, end_point
  ) VALUES (
    v_owner, p_name, p_description, v_city, v_type,
    ST_Length(v_sub::geography), COALESCE(v_elev, 0),
    v_sub::geography,
    ST_StartPoint(v_sub)::geography,
    ST_EndPoint(v_sub)::geography
  )
  RETURNING id INTO v_seg_id;

  -- O criador fica logo com o seu registo neste troço
  PERFORM public.detect_segment_efforts(p_activity_id);

  RETURN v_seg_id;
END;
$$;

-- ── Deteção de passagens ─────────────────────────────────────────────────────
-- Corre depois de guardar uma atividade: encontra os troços percorridos e
-- regista o tempo de cada passagem.

CREATE OR REPLACE FUNCTION public.detect_segment_efforts(p_activity_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner    uuid;
  v_type     text;
  v_line     geometry;
  v_found    int := 0;
  seg        RECORD;
  v_start_ts timestamptz;
  v_end_ts   timestamptz;
  v_duration real;
  v_coverage real;
BEGIN
  SELECT a.user_id, a.type INTO v_owner, v_type
  FROM public.activities a WHERE a.id = p_activity_id;
  IF v_owner IS NULL THEN RETURN 0; END IF;

  SELECT ST_SetSRID(ST_MakeLine(ST_MakePoint(p.lng, p.lat) ORDER BY p.timestamp), 4326)
  INTO v_line
  FROM public.activity_points p WHERE p.activity_id = p_activity_id;

  IF v_line IS NULL OR ST_NumPoints(v_line) < 2 THEN RETURN 0; END IF;

  FOR seg IN
    SELECT s.id, s.path, s.start_point, s.end_point, s.distance
    FROM public.segments s
    WHERE s.activity_type = v_type
      -- Passou perto do início E do fim: filtro barato antes do caro
      AND ST_DWithin(s.start_point, v_line::geography, 35)
      AND ST_DWithin(s.end_point,   v_line::geography, 35)
  LOOP
    -- Percentagem dos vértices do troço a menos de 30 m do percurso.
    -- Evita contar como passagem quem só tocou nas pontas.
    SELECT AVG(CASE WHEN ST_DWithin(d.geom::geography, v_line::geography, 30) THEN 1 ELSE 0 END)
    INTO v_coverage
    FROM ST_DumpPoints(seg.path::geometry) d;

    IF COALESCE(v_coverage, 0) < 0.8 THEN CONTINUE; END IF;

    -- Instante do ponto mais próximo do início e do fim do troço
    SELECT p.timestamp INTO v_start_ts
    FROM public.activity_points p
    WHERE p.activity_id = p_activity_id
    ORDER BY ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography <-> seg.start_point
    LIMIT 1;

    SELECT p.timestamp INTO v_end_ts
    FROM public.activity_points p
    WHERE p.activity_id = p_activity_id
    ORDER BY ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography <-> seg.end_point
    LIMIT 1;

    -- Só conta no sentido do troço
    IF v_start_ts IS NULL OR v_end_ts IS NULL OR v_end_ts <= v_start_ts THEN
      CONTINUE;
    END IF;

    v_duration := EXTRACT(EPOCH FROM (v_end_ts - v_start_ts));
    IF v_duration <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.segment_efforts (
      segment_id, activity_id, user_id, duration, pace, started_at
    ) VALUES (
      seg.id, p_activity_id, v_owner, v_duration,
      CASE WHEN seg.distance > 0 THEN v_duration / (seg.distance / 1000) ELSE NULL END,
      v_start_ts
    )
    ON CONFLICT (segment_id, activity_id) DO NOTHING;

    v_found := v_found + 1;
  END LOOP;

  RETURN v_found;
END;
$$;

-- ── Leitura ──────────────────────────────────────────────────────────────────

/** Troços percorridos numa atividade, com o meu tempo e a média da comunidade. */
CREATE OR REPLACE FUNCTION public.get_activity_segments(p_activity_id uuid)
RETURNS TABLE (
  segment_id       uuid,
  name             text,
  distance         real,
  elevation_gain   real,
  duration         real,
  pace             real,
  my_best          real,
  my_attempts      int,
  community_avg    real,
  community_people int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.name, s.distance, s.elevation_gain,
    e.duration, e.pace,
    (SELECT min(me.duration) FROM public.segment_efforts me
      WHERE me.segment_id = s.id AND me.user_id = e.user_id),
    (SELECT count(*)::int FROM public.segment_efforts me
      WHERE me.segment_id = s.id AND me.user_id = e.user_id),
    (SELECT avg(ce.duration)::real FROM public.segment_efforts ce
      JOIN public.activities ca ON ca.id = ce.activity_id
      WHERE ce.segment_id = s.id AND ca.is_public = true),
    (SELECT count(DISTINCT ce.user_id)::int FROM public.segment_efforts ce
      JOIN public.activities ca ON ca.id = ce.activity_id
      WHERE ce.segment_id = s.id AND ca.is_public = true)
  FROM public.segment_efforts e
  JOIN public.segments s ON s.id = e.segment_id
  WHERE e.activity_id = p_activity_id AND e.user_id = auth.uid()
  ORDER BY e.started_at;
$$;

/** Detalhe de um troço: o meu histórico completo e a média da comunidade. */
CREATE OR REPLACE FUNCTION public.get_segment_detail(p_segment_id uuid)
RETURNS TABLE (
  id               uuid,
  name             text,
  description      text,
  city             text,
  activity_type    text,
  distance         real,
  elevation_gain   real,
  my_attempts      int,
  my_best          real,
  my_last          real,
  my_average       real,
  community_avg    real,
  community_people int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.name, s.description, s.city, s.activity_type,
    s.distance, s.elevation_gain,
    (SELECT count(*)::int FROM public.segment_efforts e
      WHERE e.segment_id = s.id AND e.user_id = auth.uid()),
    (SELECT min(e.duration) FROM public.segment_efforts e
      WHERE e.segment_id = s.id AND e.user_id = auth.uid()),
    (SELECT e.duration FROM public.segment_efforts e
      WHERE e.segment_id = s.id AND e.user_id = auth.uid()
      ORDER BY e.started_at DESC LIMIT 1),
    (SELECT avg(e.duration)::real FROM public.segment_efforts e
      WHERE e.segment_id = s.id AND e.user_id = auth.uid()),
    (SELECT avg(ce.duration)::real FROM public.segment_efforts ce
      JOIN public.activities ca ON ca.id = ce.activity_id
      WHERE ce.segment_id = s.id AND ca.is_public = true),
    (SELECT count(DISTINCT ce.user_id)::int FROM public.segment_efforts ce
      JOIN public.activities ca ON ca.id = ce.activity_id
      WHERE ce.segment_id = s.id AND ca.is_public = true)
  FROM public.segments s
  WHERE s.id = p_segment_id;
$$;

/** Troços perto de um ponto — descoberta no mapa. */
CREATE OR REPLACE FUNCTION public.get_nearby_segments(
  p_lat double precision,
  p_lng double precision,
  p_radius int DEFAULT 15000,
  p_limit int DEFAULT 30
)
RETURNS TABLE (
  id             uuid,
  name           text,
  city           text,
  activity_type  text,
  distance       real,
  elevation_gain real,
  my_attempts    int,
  people         int,
  meters_away    real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.name, s.city, s.activity_type, s.distance, s.elevation_gain,
    (SELECT count(*)::int FROM public.segment_efforts e
      WHERE e.segment_id = s.id AND e.user_id = auth.uid()),
    (SELECT count(DISTINCT ce.user_id)::int FROM public.segment_efforts ce
      JOIN public.activities ca ON ca.id = ce.activity_id
      WHERE ce.segment_id = s.id AND ca.is_public = true),
    ST_Distance(s.start_point, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)::real
  FROM public.segments s
  WHERE ST_DWithin(s.start_point, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius)
  ORDER BY ST_Distance(s.start_point, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
  LIMIT p_limit;
$$;

/** As minhas passagens num troço, da mais recente para a mais antiga. */
CREATE OR REPLACE FUNCTION public.get_my_segment_efforts(p_segment_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE (
  id          uuid,
  activity_id uuid,
  duration    real,
  pace        real,
  started_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.activity_id, e.duration, e.pace, e.started_at
  FROM public.segment_efforts e
  WHERE e.segment_id = p_segment_id AND e.user_id = auth.uid()
  ORDER BY e.started_at DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.create_segment_from_activity(uuid, text, real, real, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.detect_segment_efforts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_activity_segments(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_segment_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_nearby_segments(double precision, double precision, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_segment_efforts(uuid, int) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_segment_from_activity(uuid, text, real, real, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_segment_efforts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_activity_segments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_segment_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_segments(double precision, double precision, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_segment_efforts(uuid, int) TO authenticated;
