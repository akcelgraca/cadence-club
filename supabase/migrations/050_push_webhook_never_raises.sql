-- ============================================================
-- 050_push_webhook_never_raises.sql
-- O gatilho de push não pode derrubar a transação de quem o provocou.
-- ============================================================
--
-- A migração 049 tratava o caso do segredo em falta (avisa e deixa passar), mas
-- **qualquer outra exceção continuava a propagar-se**: o `net.http_post` não
-- existir no schema esperado, o `pg_net` não estar instalado, uma falha ao ler
-- o Vault. E este gatilho corre dentro da transação de quem inseriu a linha em
-- `notifications` — que por sua vez corre dentro da transação de quem mandou a
-- mensagem, aceitou o pedido de adesão ou criou o evento.
--
-- Traduzido: uma falha ao *avisar* alguém fazia a própria ação falhar, e o
-- utilizador via um 500 sem relação nenhuma com notificações. É exatamente o
-- que a 049 dizia que não podia acontecer — dizia, e não garantia.
--
-- Aqui o corpo inteiro passa a ter um `EXCEPTION WHEN OTHERS`. Uma notificação
-- por enviar é um problema; uma mensagem por gravar é outro, muito maior.

CREATE OR REPLACE FUNCTION public.notify_push_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_segredo text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_segredo
    FROM vault.decrypted_secrets
    WHERE name = 'send_push_webhook_secret';

    IF v_segredo IS NULL THEN
      RAISE WARNING '[push] segredo send_push_webhook_secret ausente; notificação % não enviada', NEW.id;
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := 'https://oygedlkjvshcforoklbr.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-webhook-secret', v_segredo
                 ),
      body    := jsonb_build_object(
                   'type', 'INSERT',
                   'table', 'notifications',
                   'record', to_jsonb(NEW)
                 )
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Regista e segue. O SQLERRM fica nos logs do Postgres, que é onde se
      -- investiga isto — nunca no ecrã de quem estava só a mandar uma mensagem.
      RAISE WARNING '[push] falhou ao enviar a notificação %: % (%)', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

-- O gatilho em si não muda; só a função que ele chama.
