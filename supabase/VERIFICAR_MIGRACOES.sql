-- Diagnóstico: as migrações 042 e 043 estão aplicadas e completas?
--
-- Correr no SQL Editor do Supabase. É UMA só instrução de propósito: o editor
-- do Supabase só mostra o resultado da última instrução, por isso um ficheiro
-- com várias queries esconde as anteriores.
--
-- Lê a coluna "estado": tudo APLICADA = migração completa.

SELECT * FROM (
  SELECT 1 AS ord, '042_subscriptions' AS migracao, 'enum subscription_store' AS objeto,
    CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_store')
         THEN 'APLICADA' ELSE 'EM FALTA' END AS estado

  UNION ALL SELECT 2, '042_subscriptions', 'enum subscription_status',
    CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 3, '042_subscriptions', 'tabela subscriptions',
    CASE WHEN to_regclass('public.subscriptions') IS NOT NULL
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 4, '042_subscriptions', 'tabela subscription_events',
    CASE WHEN to_regclass('public.subscription_events') IS NOT NULL
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 5, '042_subscriptions', 'indice subscriptions_user_idx',
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'subscriptions_user_idx')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 6, '042_subscriptions', 'policy subscriptions_select_own',
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'subscriptions_select_own')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 7, '042_subscriptions', 'funcao has_entitlement()',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_entitlement')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 8, '043_health_sync', 'tabela health_sync_state',
    CASE WHEN to_regclass('public.health_sync_state') IS NOT NULL
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 9, '043_health_sync', 'indice activities_user_start_idx',
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'activities_user_start_idx')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 10, '043_health_sync', 'coluna activities.external_id',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='activities'
                        AND column_name='external_id')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 11, '043_health_sync', 'policies de health_sync_state (3)',
    CASE WHEN (SELECT count(*) FROM pg_policies
               WHERE tablename = 'health_sync_state') >= 3
         THEN 'APLICADA' ELSE 'EM FALTA' END

  -- Pendência conhecida, não é migração: ver ESTADO_DO_PROJETO.md 4.1
  UNION ALL SELECT 12, 'PENDENTE', 'coluna de freq. cardiaca em activities',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='activities'
                        AND (column_name ILIKE '%heart%' OR column_name ILIKE '%_hr%'
                             OR column_name ILIKE 'hr_%' OR column_name ILIKE '%bpm%'))
         THEN 'EXISTE' ELSE 'POR CRIAR (esperado)' END
) t
ORDER BY ord;
