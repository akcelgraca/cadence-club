-- 043_health_sync.sql
-- Importação de treinos do HealthKit (iOS) e do Health Connect (Android).
--
-- PROBLEMA QUE ISTO RESOLVE: a coluna `source` já previa 'healthkit' e
-- 'healthconnect' desde a migração 001, mas não havia forma de saber se um
-- treino já tinha sido importado. Sem isso, cada sincronização voltava a
-- criar tudo outra vez.
--
-- Duas defesas contra duplicados, porque uma não chega:
--
--   1. `external_id` — o identificador que a Apple/Google dá ao treino.
--      Apanha a mesma sincronização repetida.
--
--   2. Sobreposição de tempo — apanha o caso que o id não apanha: um treino
--      gravado na app E no relógio existe duas vezes, com ids diferentes.
--      Para o utilizador é a mesma corrida, e ver duas é pior do que não ver
--      nenhuma. Esta verificação é feita no cliente (ver services/health).

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS external_id text;

COMMENT ON COLUMN public.activities.external_id IS
  'Identificador do treino na origem (HKWorkout.uuid / Health Connect metadata.id). Null no que é gravado na app.';

-- Um treino externo só entra uma vez por pessoa. O índice é parcial porque a
-- esmagadora maioria das linhas tem external_id nulo (gravadas na app) e o
-- NULL não colide consigo próprio de forma útil num índice normal.
CREATE UNIQUE INDEX IF NOT EXISTS activities_external_unique
  ON public.activities(user_id, source, external_id)
  WHERE external_id IS NOT NULL;

-- Suporta "o que já importei desde X?" sem varrer o histórico todo.
CREATE INDEX IF NOT EXISTS activities_user_start_idx
  ON public.activities(user_id, start_time DESC);

-- ── Estado da sincronização ──────────────────────────────────────────────────

/**
 * Onde é que a última importação ficou, por pessoa e por plataforma.
 *
 * Guardar isto no servidor e não no telemóvel é de propósito: quem troca de
 * telemóvel ou reinstala não deve voltar a importar dois anos de treinos.
 */
CREATE TABLE IF NOT EXISTS public.health_sync_state (
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- 'healthkit' | 'healthconnect' — os mesmos valores de activities.source
  source         text NOT NULL CHECK (source IN ('healthkit', 'healthconnect')),

  /** Início do treino mais recente já importado. A próxima leitura começa aqui. */
  last_synced_at timestamptz,
  /** Quando é que a app tentou sincronizar pela última vez (com ou sem sucesso). */
  last_attempt_at timestamptz,
  last_error     text,
  imported_count int NOT NULL DEFAULT 0,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, source)
);

ALTER TABLE public.health_sync_state ENABLE ROW LEVEL SECURITY;

-- Ao contrário das subscrições, aqui é o telemóvel que escreve: é ele que tem
-- acesso ao HealthKit e sabe até onde leu. Não há risco em falsear isto — o
-- pior que alguém consegue é reimportar os próprios treinos.
CREATE POLICY "health_sync_state_select" ON public.health_sync_state
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "health_sync_state_insert" ON public.health_sync_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "health_sync_state_update" ON public.health_sync_state
  FOR UPDATE USING (auth.uid() = user_id);

-- ── Leitura para o cliente decidir o que importar ────────────────────────────

/**
 * Janelas temporais das atividades já registadas num intervalo.
 *
 * O cliente usa isto para descartar treinos do relógio que se sobrepõem a algo
 * que já existe. Devolve só as fronteiras — nem traçado, nem título.
 */
CREATE OR REPLACE FUNCTION public.get_activity_windows(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS TABLE (
  start_time  timestamptz,
  end_time    timestamptz,
  source      text,
  external_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.start_time, a.end_time, a.source, a.external_id
  FROM public.activities a
  WHERE a.user_id = auth.uid()
    AND a.start_time >= p_from
    AND a.start_time <= p_to
  ORDER BY a.start_time;
$$;

GRANT EXECUTE ON FUNCTION public.get_activity_windows(timestamptz, timestamptz) TO authenticated;

-- ── updated_at ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_health_sync_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS health_sync_touch_updated_at ON public.health_sync_state;
CREATE TRIGGER health_sync_touch_updated_at
  BEFORE UPDATE ON public.health_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_health_sync_updated_at();
