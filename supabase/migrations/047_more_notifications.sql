-- ============================================================
-- 047_more_notifications.sql
-- As três notificações que faltavam: pedidos de adesão a clubes,
-- mensagens diretas e eventos. Mais o interruptor que já existia
-- nas Definições e não desligava nada.
-- ============================================================

-- ── 1. O CHECK do tipo ──────────────────────────────────────────────────────
-- A tabela nasceu com cinco tipos fixos. Sem alargar isto, qualquer INSERT dos
-- gatilhos abaixo rebentava — e rebentava dentro da transação de quem enviou a
-- mensagem, ou seja, a mensagem não chegava a ser gravada.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'kudo', 'comment', 'follow', 'streak', 'badge',
    'club_request',   -- alguém pediu para entrar num clube que administras
    'club_accepted',  -- o teu pedido foi aceite
    'message',        -- mensagem direta
    'event'           -- evento novo num clube teu
  ));

-- ── 2. Preferências no servidor ─────────────────────────────────────────────
-- Os interruptores existiam no ecrã de Definições, eram guardados no
-- AsyncStorage do telemóvel, e mais ninguém os lia — nem os gatilhos, nem a
-- edge function. Desligar "Boosts" não desligava coisa nenhuma.
--
-- Ficam aqui porque quem decide enviar é o servidor. A ausência de uma chave
-- vale `true`: acrescentar um tipo novo não pode silenciar-se a si próprio em
-- quem nunca abriu as Definições.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.notification_prefs IS
  'Push por tipo: boosts, comments, follows, streaks, badges, clubs, messages, events. Chave ausente = ligado.';

-- ── 3. Pedido de adesão → avisar quem administra ────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_club_join_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome  text;
  v_clube text;
BEGIN
  SELECT full_name INTO v_nome  FROM public.profiles WHERE id = NEW.user_id;
  SELECT name      INTO v_clube FROM public.clubs    WHERE id = NEW.club_id;

  -- Administradores e dono, sem repetir quem seja as duas coisas. Quem pediu
  -- fica de fora: um admin que peça para entrar no próprio clube não se avisa.
  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message)
  SELECT DISTINCT destinatario, 'club_request', NEW.user_id, NEW.club_id,
         COALESCE(v_nome, 'Alguém') || ' pediu para entrar em ' || COALESCE(v_clube, 'um clube') || '.'
  FROM (
    SELECT user_id AS destinatario FROM public.club_members
     WHERE club_id = NEW.club_id AND role = 'admin'
    UNION
    SELECT owner_id FROM public.clubs WHERE id = NEW.club_id
  ) AS admins
  WHERE destinatario <> NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_club_join_request ON public.club_join_requests;
CREATE TRIGGER trigger_notify_on_club_join_request
  AFTER INSERT ON public.club_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_club_join_request();

-- ── 4. Pedido aceite → avisar quem pediu ────────────────────────────────────
-- Só o aceite. Uma recusa não se anuncia com um toque no telemóvel: quem
-- quiser saber vê no clube, e quem não quiser não leva com isso à mesa.

CREATE OR REPLACE FUNCTION public.notify_on_club_request_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clube text;
BEGIN
  IF NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_clube FROM public.clubs WHERE id = NEW.club_id;

  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message)
  VALUES (NEW.user_id, 'club_accepted', NEW.resolved_by, NEW.club_id,
          'Já fazes parte de ' || COALESCE(v_clube, 'um clube') || '.');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_club_request_resolved ON public.club_join_requests;
CREATE TRIGGER trigger_notify_on_club_request_resolved
  AFTER UPDATE OF status ON public.club_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_club_request_resolved();

-- ── 5. Mensagem direta → avisar os outros participantes ─────────────────────
-- Só as diretas. O chat de clube (`club_messages`) fica de fora de propósito:
-- num clube com conversa, uma notificação por mensagem é o caminho mais curto
-- para a pessoa desligar as notificações todas.

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
BEGIN
  SELECT full_name INTO v_nome FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message)
  SELECT p.user_id, 'message', NEW.sender_id, NEW.conversation_id,
         COALESCE(v_nome, 'Alguém') || ': ' ||
         -- O corpo vai truncado: a pré-visualização do sistema já corta, e uma
         -- mensagem longa inteira dentro da linha da lista não se lê.
         CASE WHEN char_length(NEW.body) > 80
              THEN left(NEW.body, 77) || '...'
              ELSE NEW.body END
  FROM public.conversation_participants p
  WHERE p.conversation_id = NEW.conversation_id
    AND p.user_id <> NEW.sender_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_message ON public.messages;
CREATE TRIGGER trigger_notify_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- ── 6. Evento novo → avisar os membros do clube ─────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_club_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clube text;
BEGIN
  SELECT name INTO v_clube FROM public.clubs WHERE id = NEW.club_id;

  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message)
  SELECT m.user_id, 'event', NEW.created_by, NEW.club_id,
         COALESCE(v_clube, 'Um clube') || ': ' || NEW.title ||
         ' · ' || to_char(NEW.starts_at AT TIME ZONE 'Europe/Lisbon', 'DD/MM HH24:MI')
  FROM public.club_members m
  WHERE m.club_id = NEW.club_id
    AND m.user_id <> NEW.created_by;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_club_event ON public.club_events;
CREATE TRIGGER trigger_notify_on_club_event
  AFTER INSERT ON public.club_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_club_event();
