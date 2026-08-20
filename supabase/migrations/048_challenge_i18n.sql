-- ============================================================
-- 048_challenge_i18n.sql
-- Os desafios passam a guardar chaves de tradução em vez de texto,
-- e ganham a coluna que diz se são coletivos.
-- ============================================================
--
-- Mesmo caminho da migração 041, que fez isto aos planos de treino: a coluna
-- guardava português, escrito no momento da inserção, e ficava assim para
-- sempre — mesmo para quem usa a app em inglês. Passa a guardar a chave, que
-- a app resolve ao desenhar.
--
-- Linhas que não correspondam a nenhum texto conhecido ficam como estão. O
-- i18next devolve a própria chave quando não a encontra, portanto um desafio
-- que escape ao mapeamento continua a aparecer em português, como antes. Não
-- há regressão para quem ficar de fora.

UPDATE public.challenges
SET name = CASE name
      WHEN 'Desafio do Mês — 100 km'      THEN 'challenge_month_100km_name'
      WHEN 'Meta da Comunidade — 1000 km' THEN 'challenge_community_1000km_name'
      WHEN '12 Treinos no Mês'            THEN 'challenge_12_workouts_name'
      ELSE name
    END,
    description = CASE description
      WHEN 'Soma 100 km de qualquer atividade este mês. Sem pressão, sem rankings — só consistência.'
        THEN 'challenge_month_100km_desc'
      WHEN 'Juntos somamos 1000 km este mês. Cada quilómetro teu conta para o total da comunidade.'
        THEN 'challenge_community_1000km_desc'
      WHEN 'Três treinos por semana, doze no mês. O objetivo é o hábito, não o cronómetro.'
        THEN 'challenge_12_workouts_desc'
      ELSE description
    END;

-- ── Coletivo passa a ser um dado, não uma adivinha ──────────────────────────
-- O ecrã decidia se um desafio era coletivo com
-- `challenge.name.toLowerCase().includes('comunidade')`. Além de frágil, isso
-- morria de vez assim que o nome passasse a ser uma chave — e morria em
-- silêncio, com o desafio da comunidade a mostrar progresso individual.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS is_collective boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.challenges.is_collective IS
  'Meta somada por toda a comunidade em vez de individual. Antes era adivinhado pelo nome.';

UPDATE public.challenges
SET is_collective = true
WHERE name = 'challenge_community_1000km_name'
   OR name ILIKE '%comunidade%';

-- ── A função tem de devolver a coluna nova ──────────────────────────────────
-- `CREATE OR REPLACE` não altera o tipo de retorno: é preciso deixar cair a
-- função primeiro, senão sai `42P13 cannot change return type`.

DROP FUNCTION IF EXISTS public.get_challenges_with_progress();

CREATE FUNCTION public.get_challenges_with_progress()
RETURNS TABLE (
  id                 uuid,
  name               text,
  description        text,
  type               text,
  goal               real,
  start_date         date,
  end_date           date,
  is_collective      boolean,
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
    ch.is_collective,
    COALESCE((SELECT count(*)::int FROM public.user_challenges u WHERE u.challenge_id = ch.id), 0),
    EXISTS (SELECT 1 FROM public.user_challenges u WHERE u.challenge_id = ch.id AND u.user_id = auth.uid()),
    COALESCE((SELECT p.value FROM progress p WHERE p.challenge_id = ch.id AND p.user_id = auth.uid()), 0)::real,
    COALESCE((SELECT sum(p.value) FROM progress p WHERE p.challenge_id = ch.id), 0)::real
  FROM public.challenges ch
  ORDER BY (ch.end_date >= current_date) DESC, ch.end_date ASC;
$$;

REVOKE ALL ON FUNCTION public.get_challenges_with_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_challenges_with_progress() TO authenticated;
