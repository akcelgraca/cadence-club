-- 052 — quadro de tempos dos troços
--
-- ⚠️ Isto REVERTE uma decisão da 039, que dizia no cabeçalho:
--
--     "Não há classificação nem KOM — a app mede consistência, não competição
--      entre pessoas."
--
-- A decisão mudou a 26 de agosto de 2026. A competição à volta dos troços é o
-- que prende as pessoas ao Strava, e a 039 tinha construído tudo o que ela
-- precisa — os tempos já lá estão, gravados desde então, e as RLS já resolvem
-- a parte difícil. Faltava só olhar para eles.
--
-- ── A privacidade não é uma preocupação nova aqui ───────────────────────────
--
-- A política `segment_efforts_select` da 039 já dizia que os tempos de outra
-- pessoa só se veem se a atividade de origem for **pública**. Este quadro segue
-- exatamente a mesma regra, e escreve-a outra vez de forma explícita porque a
-- função é SECURITY DEFINER: dentro dela as RLS não se aplicam, e esquecer o
-- filtro exporia tempos de treinos privados a toda a gente.
--
-- Consequência, e é deliberada: quem tem as atividades privadas **não aparece**
-- no quadro. Não se pode competir em público com dados que se escolheu não
-- mostrar. A app diz isso a quem estiver nesse caso, em vez de o deixar a
-- pensar que não tem tempos.

CREATE OR REPLACE FUNCTION public.get_segment_leaderboard(
  p_segment_id uuid,
  p_limit      int DEFAULT 20
)
RETURNS TABLE (
  pos          int,
  user_id      uuid,
  full_name    text,
  username     text,
  avatar_url   text,
  duration     real,
  pace         real,
  started_at   timestamptz,
  activity_id  uuid,
  is_me        boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH melhores AS (
    -- Um tempo por pessoa, o melhor. Sem isto, quem repete o troço todas as
    -- semanas enchia o quadro sozinho e ele deixava de dizer alguma coisa.
    SELECT DISTINCT ON (e.user_id)
      e.user_id, e.duration, e.pace, e.started_at, e.activity_id
    FROM public.segment_efforts e
    JOIN public.activities a ON a.id = e.activity_id
    WHERE e.segment_id = p_segment_id
      AND a.is_public = true        -- ver o comentário do cabeçalho
    ORDER BY e.user_id, e.duration ASC, e.started_at ASC
  ),
  ordenado AS (
    SELECT
      -- `rank()` e não `row_number()`: dois tempos iguais são o mesmo lugar.
      -- Desempatar pela data dava a um deles um lugar que não ganhou.
      rank() OVER (ORDER BY m.duration ASC)::int AS pos,
      m.user_id, m.duration, m.pace, m.started_at, m.activity_id
    FROM melhores m
  )
  SELECT
    o.pos, o.user_id, p.full_name, p.username, p.avatar_url,
    o.duration, o.pace, o.started_at, o.activity_id,
    (o.user_id = auth.uid()) AS is_me
  FROM ordenado o
  JOIN public.profiles p ON p.id = o.user_id
  -- O próprio vem sempre, mesmo fora dos primeiros: "o 47.º de 300" é
  -- informação; uma lista onde não te encontras não é.
  WHERE o.pos <= p_limit OR o.user_id = auth.uid()
  ORDER BY o.pos, o.started_at;
$$;

REVOKE ALL ON FUNCTION public.get_segment_leaderboard(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_segment_leaderboard(uuid, int) TO authenticated;

COMMENT ON FUNCTION public.get_segment_leaderboard(uuid, int) IS
  'Melhor tempo por pessoa num troço, só de atividades públicas. Devolve os p_limit primeiros mais a linha de quem chama, esteja ela onde estiver.';
