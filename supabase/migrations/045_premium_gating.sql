-- Migration 045: impor os limites do plano gratuito no servidor
--
-- A migração 042 criou has_entitlement(), mas ninguém a usava para bloquear
-- nada. Esta liga-a às três funcionalidades premium que são MESMO acesso a
-- dados.
--
-- O QUE NÃO ESTÁ AQUI, DE PROPÓSITO. Vista 3D, estilos de mapa e exportação
-- são renderização no cliente: o servidor não tem como as impedir, e fingir
-- que impõe alguma coisa seria pior do que assumir que não impõe. Essas vivem
-- só no usePremium() do lado da app, para mostrar o cadeado.
--
-- O QUE ESTÁ AQUI é o que um cliente modificado conseguiria contornar se não
-- fosse imposto: pedir 24 meses de tendências, pedir o histórico todo de um
-- troço, ou enfiar 6 fotos numa atividade.
--
-- ⚠️ INTERRUPTOR: enquanto public.premium_gating_enabled() devolver false,
-- tudo isto deixa passar. É o que permite aplicar a migração agora e ligar a
-- monetização mais tarde, sem uma segunda migração.

-- ============================================================
-- 0. O interruptor
-- ============================================================
-- Uma tabela de uma linha em vez de uma constante: dá para ligar e desligar
-- com um UPDATE, sem migrar nada nem publicar versão nova da app.
CREATE TABLE IF NOT EXISTS public.app_flags (
  key        text PRIMARY KEY,
  enabled    boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_flags (key, enabled)
VALUES ('premium_gating', false)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;

-- Qualquer utilizador autenticado pode LER as flags (a app precisa de saber
-- se deve mostrar o paywall). Ninguém as escreve pela API — só pelo painel.
DROP POLICY IF EXISTS "app_flags_select" ON public.app_flags;
CREATE POLICY "app_flags_select" ON public.app_flags
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.premium_gating_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT enabled FROM public.app_flags WHERE key = 'premium_gating'), false);
$$;

/**
 * Verdadeiro quando o utilizador PODE usar a funcionalidade premium.
 *
 * Com o gating desligado devolve sempre true — é o que mantém a app aberta
 * enquanto a monetização não arranca.
 */
CREATE OR REPLACE FUNCTION public.can_use_premium(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.premium_gating_enabled()
      OR public.has_entitlement(p_user_id, 'premium');
$$;

GRANT EXECUTE ON FUNCTION public.premium_gating_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_premium(uuid) TO authenticated;

-- Limites do plano gratuito, num sítio só. Têm de bater certo com
-- FREE_HISTORY_MONTHS e FREE_PHOTO_LIMIT em src/hooks/usePremium.ts.
CREATE OR REPLACE FUNCTION public.free_history_months() RETURNS int
  LANGUAGE sql IMMUTABLE AS $$ SELECT 3 $$;
CREATE OR REPLACE FUNCTION public.free_segment_efforts() RETURNS int
  LANGUAGE sql IMMUTABLE AS $$ SELECT 3 $$;
CREATE OR REPLACE FUNCTION public.free_photo_limit() RETURNS int
  LANGUAGE sql IMMUTABLE AS $$ SELECT 2 $$;

-- ============================================================
-- 1. Tendências: limitar a janela de meses
-- ============================================================
-- O cliente já pede um número de meses; sem isto, pedir 24 devolvia 24.
CREATE OR REPLACE FUNCTION get_monthly_stats(p_user_id UUID, p_months INTEGER DEFAULT 12)
RETURNS TABLE(
  month_year TEXT,
  total_distance REAL,
  total_duration REAL,
  total_elevation REAL,
  activity_count BIGINT
) AS $$
DECLARE
  v_start_date DATE;
  v_months     INTEGER;
BEGIN
  -- Só o próprio pode ver as suas tendências; para outros, a janela gratuita
  -- é o máximo, independentemente do que o dono tenha comprado.
  IF p_user_id = auth.uid() AND public.can_use_premium(p_user_id) THEN
    v_months := p_months;
  ELSE
    v_months := LEAST(p_months, public.free_history_months());
  END IF;

  v_start_date := (date_trunc('month', NOW()::DATE) - (v_months - 1 || ' months')::INTERVAL)::DATE;

  RETURN QUERY
  SELECT
    to_char(a.start_time::DATE, 'YYYY-MM') AS month_year,
    COALESCE(SUM(a.distance), 0)::REAL,
    COALESCE(SUM(a.duration), 0)::REAL,
    COALESCE(SUM(a.elevation_gain), 0)::REAL,
    COUNT(a.id)
  FROM public.activities a
  WHERE a.user_id = p_user_id
    AND a.start_time::DATE >= v_start_date
  GROUP BY month_year
  ORDER BY month_year;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 2. Histórico de troços: limitar o número de passagens
-- ============================================================
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
  LIMIT CASE
    WHEN public.can_use_premium(auth.uid()) THEN p_limit
    ELSE LEAST(p_limit, public.free_segment_efforts())
  END;
$$;

REVOKE ALL ON FUNCTION public.get_my_segment_efforts(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_segment_efforts(uuid, int) TO authenticated;

-- ============================================================
-- 3. Fotos: travar a inserção acima do limite gratuito
-- ============================================================
-- Aqui não há RPC para alterar — o cliente escreve direto na tabela. Um
-- trigger é a única forma de impor isto sem reescrever o caminho de escrita.
CREATE OR REPLACE FUNCTION public.enforce_photo_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dono   uuid;
  v_atuais int;
BEGIN
  SELECT a.user_id INTO v_dono
  FROM public.activities a WHERE a.id = NEW.activity_id;

  IF v_dono IS NULL OR public.can_use_premium(v_dono) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_atuais
  FROM public.activity_photos p WHERE p.activity_id = NEW.activity_id;

  IF v_atuais >= public.free_photo_limit() THEN
    -- Código próprio para a app poder distinguir isto de um erro genérico e
    -- abrir o paywall em vez de dizer "algo correu mal".
    RAISE EXCEPTION 'photo limit reached for free plan'
      USING ERRCODE = 'P0001', HINT = 'premium_required';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_photo_limit ON public.activity_photos;
CREATE TRIGGER trg_enforce_photo_limit
  BEFORE INSERT ON public.activity_photos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_photo_limit();

-- ============================================================
-- Como ligar a monetização, quando chegar o dia
-- ============================================================
--   UPDATE public.app_flags SET enabled = true, updated_at = now()
--   WHERE key = 'premium_gating';
--
-- E para voltar atrás, o mesmo com false. Não é preciso publicar app nova.
