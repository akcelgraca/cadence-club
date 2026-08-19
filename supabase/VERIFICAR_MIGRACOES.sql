-- Diagnóstico: as migrações 042 a 046 estão aplicadas e completas?
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

  -- ── 044: importação de ficheiros ─────────────────────────────────────────
  UNION ALL SELECT 12, '044_import_sources', 'activities.source aceita gpx/tcx/fit',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'activities'
        AND pg_get_constraintdef(c.oid) ILIKE '%gpx%'
    ) THEN 'APLICADA' ELSE 'EM FALTA' END

  -- ── 045: limites do plano gratuito ───────────────────────────────────────
  UNION ALL SELECT 13, '045_premium_gating', 'tabela app_flags',
    CASE WHEN to_regclass('public.app_flags') IS NOT NULL
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 14, '045_premium_gating', 'funcao premium_gating_enabled()',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'premium_gating_enabled')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  -- Não é erro estar desligado: é o estado esperado até haver o que vender.
  UNION ALL SELECT 15, '045_premium_gating', 'interruptor premium_gating',
    CASE WHEN public.premium_gating_enabled()
         THEN 'LIGADO (paywall a valer)' ELSE 'DESLIGADO (esperado)' END

  -- ── 046: frequência cardíaca ─────────────────────────────────────────────
  UNION ALL SELECT 16, '046_heart_rate', 'coluna activities.avg_heart_rate',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='activities'
                        AND column_name='avg_heart_rate')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 17, '046_heart_rate', 'coluna activities.max_heart_rate',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='activities'
                        AND column_name='max_heart_rate')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 18, '046_heart_rate', 'coluna profiles.max_heart_rate',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='profiles'
                        AND column_name='max_heart_rate')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  -- Sem a CHECK, um sensor com defeito grava 900 bpm e as zonas ficam absurdas.
  UNION ALL SELECT 19, '046_heart_rate', 'limites 30-240 em avg_heart_rate',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'activities'
        AND pg_get_constraintdef(c.oid) ILIKE '%avg_heart_rate%'
        AND pg_get_constraintdef(c.oid) ILIKE '%240%'
    ) THEN 'APLICADA' ELSE 'EM FALTA' END
) t
ORDER BY ord;
