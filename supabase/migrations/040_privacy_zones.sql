-- 040_privacy_zones.sql
-- Zonas de privacidade.
--
-- PROBLEMA QUE ISTO CORRIGE: o rasto de GPS era guardado inteiro e a política
-- activity_points_select deixava qualquer seguidor (ou qualquer pessoa, se a
-- atividade fosse pública) ler todos os pontos — incluindo os primeiros e os
-- últimos, que são a porta de casa de quem treina.
--
-- Estratégia:
--   • as zonas são dados sensíveis (são a morada) → só o dono as lê;
--   • activity_points passa a ser legível diretamente APENAS pelo dono;
--   • os outros leem através de get_activity_points_visible(), que corta os
--     pontos dentro das zonas;
--   • activities.route_summary (coluna que qualquer um lê) passa a guardar
--     já a versão cortada.

-- ── Zonas ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.privacy_zones (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label      text        NOT NULL DEFAULT 'Casa',
  center     geography(POINT, 4326) NOT NULL,
  radius     int         NOT NULL DEFAULT 500 CHECK (radius BETWEEN 100 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS privacy_zones_user_idx ON public.privacy_zones(user_id);

ALTER TABLE public.privacy_zones ENABLE ROW LEVEL SECURITY;

-- Sem exceções: uma zona de privacidade é a morada de alguém.
CREATE POLICY "privacy_zones_select" ON public.privacy_zones
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "privacy_zones_insert" ON public.privacy_zones
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "privacy_zones_update" ON public.privacy_zones
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "privacy_zones_delete" ON public.privacy_zones
  FOR DELETE USING (auth.uid() = user_id);

-- ── Rasto de GPS: leitura direta só para o dono ──────────────────────────────

DROP POLICY IF EXISTS "activity_points_select" ON public.activity_points;
CREATE POLICY "activity_points_select" ON public.activity_points
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_points.activity_id AND a.user_id = auth.uid()
    )
  );

-- ── Leitura protegida para terceiros ─────────────────────────────────────────

/**
 * Pontos de uma atividade visíveis para quem chama.
 * O dono recebe tudo; os outros recebem o rasto sem os pontos que caem dentro
 * das zonas de privacidade do dono.
 */
CREATE OR REPLACE FUNCTION public.get_activity_points_visible(p_activity_id uuid)
RETURNS TABLE (
  lat       double precision,
  lng       double precision,
  elevation real,
  "timestamp" timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner  uuid;
  v_public boolean;
  v_can_see boolean;
BEGIN
  SELECT a.user_id, a.is_public INTO v_owner, v_public
  FROM public.activities a WHERE a.id = p_activity_id;

  IF v_owner IS NULL THEN RETURN; END IF;

  -- Mesma visibilidade das atividades: pública, própria, ou de quem sigo
  v_can_see := v_public
    OR v_owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid() AND f.following_id = v_owner
    );
  IF NOT v_can_see THEN RETURN; END IF;

  IF v_owner = auth.uid() THEN
    RETURN QUERY
      SELECT p.lat, p.lng, p.elevation, p.timestamp
      FROM public.activity_points p
      WHERE p.activity_id = p_activity_id
      ORDER BY p.timestamp;
  ELSE
    RETURN QUERY
      SELECT p.lat, p.lng, p.elevation, p.timestamp
      FROM public.activity_points p
      WHERE p.activity_id = p_activity_id
        AND NOT EXISTS (
          SELECT 1 FROM public.privacy_zones z
          WHERE z.user_id = v_owner
            AND ST_DWithin(
                  z.center,
                  ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
                  z.radius)
        )
      ORDER BY p.timestamp;
  END IF;
END;
$$;

-- ── Recalcular o resumo público de uma atividade ─────────────────────────────

/**
 * Reescreve activities.route_summary sem os pontos dentro das zonas do dono.
 * Usa-se ao criar/alterar/apagar zonas — as atividades antigas ficavam
 * expostas se só se filtrasse na gravação.
 */
CREATE OR REPLACE FUNCTION public.apply_privacy_zones(p_activity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner   uuid;
  v_summary jsonb;
BEGIN
  SELECT a.user_id INTO v_owner
  FROM public.activities a WHERE a.id = p_activity_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão para esta atividade';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_array(p.lat, p.lng) ORDER BY p.timestamp), '[]'::jsonb)
  INTO v_summary
  FROM public.activity_points p
  WHERE p.activity_id = p_activity_id
    AND NOT EXISTS (
      SELECT 1 FROM public.privacy_zones z
      WHERE z.user_id = v_owner
        AND ST_DWithin(
              z.center,
              ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
              z.radius)
    );

  UPDATE public.activities
  SET route_summary = v_summary
  WHERE id = p_activity_id;
END;
$$;

/** Aplica as zonas a todas as minhas atividades. Devolve quantas mudaram. */
CREATE OR REPLACE FUNCTION public.apply_privacy_zones_to_all()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  rec     RECORD;
BEGIN
  FOR rec IN
    SELECT a.id FROM public.activities a
    WHERE a.user_id = auth.uid() AND a.route_summary IS NOT NULL
  LOOP
    PERFORM public.apply_privacy_zones(rec.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ── Guarda nos troços ────────────────────────────────────────────────────────
-- Um troço é público; criar um que comece à porta de casa anularia as zonas.

CREATE OR REPLACE FUNCTION public.segment_overlaps_my_zones(
  p_start_lat double precision, p_start_lng double precision,
  p_end_lat   double precision, p_end_lng   double precision
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.privacy_zones z
    WHERE z.user_id = auth.uid()
      AND (
        ST_DWithin(z.center, ST_SetSRID(ST_MakePoint(p_start_lng, p_start_lat), 4326)::geography, z.radius)
        OR ST_DWithin(z.center, ST_SetSRID(ST_MakePoint(p_end_lng, p_end_lat), 4326)::geography, z.radius)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.get_activity_points_visible(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_privacy_zones(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_privacy_zones_to_all() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.segment_overlaps_my_zones(double precision, double precision, double precision, double precision) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_activity_points_visible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_privacy_zones(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_privacy_zones_to_all() TO authenticated;
GRANT EXECUTE ON FUNCTION public.segment_overlaps_my_zones(double precision, double precision, double precision, double precision) TO authenticated;
