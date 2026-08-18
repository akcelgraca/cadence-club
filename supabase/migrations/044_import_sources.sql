-- Migration 044: aceitar atividades importadas de ficheiro
--
-- A coluna activities.source só admitia ('app', 'healthkit', 'healthconnect').
-- Qualquer importação de ficheiro era rejeitada pela CHECK.
--
-- Acrescenta 'gpx', 'tcx' e 'fit' de uma vez. O FIT ainda não está
-- implementado, mas incluí-lo agora evita uma segunda migração só para isso —
-- alargar a constraint não obriga a app a produzir o valor.

-- ============================================================
-- 1. Trocar a CHECK de activities.source
-- ============================================================
DO $$
DECLARE
    nome_constraint TEXT;
BEGIN
    -- O nome é gerado pelo Postgres e pode variar entre ambientes, por isso
    -- procura-se pela coluna em vez de assumir o nome.
    SELECT c.conname INTO nome_constraint
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'activities'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%source%';

    IF nome_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.activities DROP CONSTRAINT %I', nome_constraint);
    END IF;

    ALTER TABLE public.activities
        ADD CONSTRAINT activities_source_check
        CHECK (source IN ('app', 'healthkit', 'healthconnect', 'gpx', 'tcx', 'fit'));
END $$;

-- ============================================================
-- 2. Índice para a deduplicação por external_id
-- ============================================================
-- A migração 043 criou external_id a pensar na sincronização com a Saúde.
-- As importações de ficheiro usam a mesma coluna (o hash do conteúdo), por
-- isso a procura de "já importei isto?" passa a ser feita também por aqui.
CREATE INDEX IF NOT EXISTS activities_user_external_idx
    ON public.activities(user_id, external_id)
    WHERE external_id IS NOT NULL;
