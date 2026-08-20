-- ============================================================
-- 049_push_webhook.sql
-- O gatilho que faltava: quem chama a edge function `send-push`.
-- ============================================================
--
-- A função estava publicada desde sempre e nunca era invocada. Publicar uma
-- edge function não cria nada na base de dados — é preciso um gatilho que a
-- chame. Resultado: as notificações apareciam na lista dentro da app e o
-- telemóvel nunca tocava, sem erro em lado nenhum.
--
-- O painel do Supabase faz isto em "Integrations › Database Webhooks", e o que
-- gera é um gatilho a chamar `supabase_functions.http_request` com o segredo
-- escrito na definição. Aqui faz-se por SQL, por duas razões: fica em migração
-- como tudo o resto, e o segredo passa a vir do Vault em vez de ficar colado ao
-- gatilho.
--
-- ⚠️ ANTES DE APLICAR, guardar o segredo (uma vez, e **não** commitar):
--
--   SELECT vault.create_secret('o-teu-segredo', 'send_push_webhook_secret');
--
-- Tem de ser o mesmo valor que está em WEBHOOK_SECRET nas variáveis da edge
-- function. Para o trocar mais tarde:
--
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'send_push_webhook_secret'),
--     'o-novo-segredo');

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_push_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_segredo text;
BEGIN
  SELECT decrypted_secret INTO v_segredo
  FROM vault.decrypted_secrets
  WHERE name = 'send_push_webhook_secret';

  -- Sem segredo não se envia — mas também não se rebenta.
  --
  -- Este gatilho corre DENTRO da transação de quem mandou a mensagem. Um
  -- `RAISE` aqui faria a mensagem não chegar a ser gravada: trocaríamos uma
  -- notificação em falta por uma mensagem perdida, que é muito pior. O aviso
  -- fica nos logs do Postgres.
  IF v_segredo IS NULL THEN
    RAISE WARNING '[push] segredo send_push_webhook_secret ausente no Vault; notificação % não foi enviada', NEW.id;
    RETURN NEW;
  END IF;

  -- Assíncrono: o `net.http_post` põe o pedido numa fila e devolve logo. Quem
  -- enviou a mensagem não fica à espera da resposta do Expo.
  PERFORM net.http_post(
    url     := 'https://oygedlkjvshcforoklbr.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_segredo
               ),
    -- O formato que a função espera, igual ao que o painel do Supabase envia.
    body    := jsonb_build_object(
                 'type', 'INSERT',
                 'table', 'notifications',
                 'record', to_jsonb(NEW)
               )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_push_webhook ON public.notifications;
CREATE TRIGGER trigger_notify_push_webhook
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_webhook();

-- Verificar depois de aplicar:
--   supabase/VERIFICAR_PUSH.sql  →  o elo 3 passa a EXISTE
