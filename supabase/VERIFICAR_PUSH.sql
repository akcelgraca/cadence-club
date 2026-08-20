-- Diagnóstico do push: qual dos cinco elos está partido?
--
-- Correr no SQL Editor do Supabase. É UMA só instrução de propósito — o editor
-- só mostra o resultado da última.
--
-- Uma notificação atravessa cinco passos e o sintoma de falha é sempre o mesmo:
-- o telemóvel não toca. Isto separa os que se veem da base de dados (1, 2, 3)
-- dos que só se veem nos logs da edge function (4, 5).

SELECT * FROM (
  -- ── Elo 3: existe o webhook que chama a função? ──────────────────────────
  -- É o mais provável de faltar. Publicar a edge function NÃO cria o gatilho:
  -- os "Database Webhooks" do Supabase são, por baixo, um trigger que chama
  -- `supabase_functions.http_request`. Sem ele, a função nunca é invocada e as
  -- notificações ficam-se pela lista dentro da app.
  SELECT 1 AS ord, 'elo 3' AS elo, 'webhook em INSERT na notifications' AS objeto,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_proc  p ON p.oid = t.tgfoid
      WHERE c.relname = 'notifications'
        AND NOT t.tgisinternal
        -- `http_request` é o que o painel do Supabase gera;
        -- `notify_push_webhook` é o da migração 049.
        AND p.proname IN ('http_request', 'notify_push_webhook')
    ) THEN 'EXISTE' ELSE 'EM FALTA  ← é aqui' END AS estado

  -- O segredo tem de estar no Vault com este nome, senão o gatilho da 049
  -- avisa nos logs e não envia. Só se verifica a existência, nunca o valor.
  UNION ALL SELECT 1, 'elo 3', 'segredo send_push_webhook_secret no Vault',
    CASE WHEN EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'send_push_webhook_secret')
         THEN 'EXISTE' ELSE 'EM FALTA' END

  -- Se o schema não existir, os Database Webhooks nunca foram ativados no
  -- projeto. Ativam-se uma vez, no painel.
  UNION ALL SELECT 2, 'elo 3', 'extensão de webhooks ativada',
    CASE WHEN EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'supabase_functions')
         THEN 'ATIVA' ELSE 'POR ATIVAR' END

  -- Todos os gatilhos não-internos da tabela, para se ver o que lá está mesmo.
  UNION ALL
  SELECT 3, 'elo 3', 'gatilho: ' || t.tgname,
         'aponta para ' || p.proname
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc  p ON p.oid = t.tgfoid
  WHERE c.relname = 'notifications' AND NOT t.tgisinternal

  -- ── Elo 1: a app guardou o token? ────────────────────────────────────────
  -- Um token válido começa por `ExponentPushToken[`. Zero aqui significa que
  -- nenhuma app registou — no Android, é sinal de FCM mal ligado.
  UNION ALL SELECT 4, 'elo 1', 'perfis com token de push',
    (SELECT count(*)::text FROM public.profiles
      WHERE expo_push_token LIKE 'ExponentPushToken[%')

  UNION ALL SELECT 5, 'elo 1', 'perfis com token inválido (lixo guardado)',
    (SELECT count(*)::text FROM public.profiles
      WHERE expo_push_token IS NOT NULL
        AND expo_push_token NOT LIKE 'ExponentPushToken[%')

  -- ── Elo 2: os gatilhos estão a criar linhas? ─────────────────────────────
  UNION ALL SELECT 6, 'elo 2', 'notificações na última hora',
    (SELECT count(*)::text FROM public.notifications
      WHERE created_at > now() - interval '1 hour')

  -- As últimas três, para se ver se são as que se espera.
  UNION ALL
  SELECT 7, 'elo 2', 'recente: ' || n.type, left(n.message, 60)
  FROM (
    SELECT type, message FROM public.notifications
    ORDER BY created_at DESC LIMIT 3
  ) n

  -- ── Elo 4: o que a edge function respondeu ───────────────────────────────
  -- O `pg_net` guarda as respostas. Isto poupa a ida aos logs da função e diz
  -- logo qual é o problema:
  --
  --   200  a função aceitou. Se mesmo assim nada chega, é elo 5 (credenciais)
  --   401  o segredo do Vault não bate com o WEBHOOK_SECRET da função
  --   500  a função não tem WEBHOOK_SECRET definido
  --   sem linhas nenhumas → o gatilho não está a disparar (volta ao elo 3)
  UNION ALL
  SELECT 8, 'elo 4', 'resposta HTTP ' || r.status_code::text,
         left(coalesce(r.content, r.error_msg, ''), 60)
  FROM (
    SELECT status_code, content, error_msg
    FROM net._http_response
    ORDER BY created DESC LIMIT 5
  ) r
) t
ORDER BY ord;
