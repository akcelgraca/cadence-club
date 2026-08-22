-- Diagnóstico: as migrações 042 a 051 estão aplicadas e completas?
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

  -- ── 047: notificações de clubes, mensagens e eventos ─────────────────────
  -- O CHECK é o que mais custa se falhar: o INSERT do gatilho rebenta dentro
  -- da transação de quem enviou a mensagem, e a mensagem perde-se.
  UNION ALL SELECT 20, '047_more_notifications', 'CHECK aceita os 4 tipos novos',
    CASE WHEN (
      SELECT bool_and(pg_get_constraintdef(con.oid) ILIKE '%' || tipo || '%')
      FROM pg_constraint con,
           unnest(ARRAY['club_request','club_accepted','message','event']) AS tipo
      WHERE con.conname = 'notifications_type_check'
    ) THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 21, '047_more_notifications', 'coluna profiles.notification_prefs',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='profiles'
                        AND column_name='notification_prefs')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  -- Quatro gatilhos, um por tipo. Faltar um é não haver notificação nenhuma
  -- desse lado, e em silêncio.
  UNION ALL SELECT 22, '047_more_notifications', 'gatilho: pedido de adesao',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_notify_on_club_join_request')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 23, '047_more_notifications', 'gatilho: pedido aceite',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_notify_on_club_request_resolved')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 24, '047_more_notifications', 'gatilho: mensagem direta',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_notify_on_message')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 25, '047_more_notifications', 'gatilho: evento de clube',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_notify_on_club_event')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  -- ── 048: desafios traduzíveis ────────────────────────────────────────────
  UNION ALL SELECT 26, '048_challenge_i18n', 'nomes convertidos em chaves',
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.challenges WHERE name ILIKE '%comunidade%'
                                                             OR name ILIKE 'Desafio do%')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 27, '048_challenge_i18n', 'coluna challenges.is_collective',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='challenges'
                        AND column_name='is_collective')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  -- Se a função não devolver a coluna, o ecrã recebe `undefined` e o desafio
  -- coletivo passa a mostrar progresso individual — sem erro nenhum.
  UNION ALL SELECT 28, '048_challenge_i18n', 'RPC devolve is_collective',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.proname = 'get_challenges_with_progress'
        AND array_to_string(p.proargnames, ',') ILIKE '%is_collective%'
    ) THEN 'APLICADA' ELSE 'EM FALTA' END

  -- Deve haver exatamente um coletivo entre os desafios de arranque.
  UNION ALL SELECT 29, '048_challenge_i18n', 'desafio coletivo marcado',
    CASE WHEN (SELECT count(*) FROM public.challenges WHERE is_collective) >= 1
         THEN 'APLICADA' ELSE 'EM FALTA' END

  -- ── 051: notificações traduzíveis ────────────────────────────────────────
  UNION ALL SELECT 30, '051_notification_i18n', 'coluna profiles.language',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='profiles'
                        AND column_name='language')
         THEN 'APLICADA' ELSE 'EM FALTA' END

  UNION ALL SELECT 31, '051_notification_i18n', 'colunas message_key e message_params',
    CASE WHEN (SELECT count(*) FROM information_schema.columns
               WHERE table_schema='public' AND table_name='notifications'
                 AND column_name IN ('message_key','message_params')) = 2
         THEN 'APLICADA' ELSE 'EM FALTA' END

  -- As colunas existirem não chega: se as funções não tiverem sido
  -- substituídas, continuam a gravar só o texto português e as colunas ficam
  -- vazias para sempre — sem erro nenhum, que é o pior tipo de falha.
  -- Verificam-se as nove pelo corpo da função.
  UNION ALL SELECT 32, '051_notification_i18n', 'as 9 funções gravam message_key',
    CASE WHEN (
      SELECT count(*) FROM pg_proc
      WHERE proname IN ('notify_on_follow','after_kudo_insert','notify_on_comment',
                        'notify_on_badge_earned','update_streak',
                        'notify_on_club_join_request','notify_on_club_request_resolved',
                        'notify_on_message','notify_on_club_event')
        AND prosrc ILIKE '%message_key%'
    ) = 9 THEN 'APLICADA' ELSE 'EM FALTA' END

  -- O evento tem de guardar a data em ISO, não formatada: se ficou o
  -- `to_char(... 'DD/MM HH24:MI')` dentro dos parâmetros, o formato português
  -- fica congelado na base de dados para toda a gente.
  UNION ALL SELECT 33, '051_notification_i18n', 'evento guarda starts_at em ISO',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_on_club_event'
                        AND prosrc ILIKE '%starts_at%' AND prosrc ILIKE '%YYYY-MM-DD%')
         THEN 'APLICADA' ELSE 'EM FALTA' END
) t
ORDER BY ord;
