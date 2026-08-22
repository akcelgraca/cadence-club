-- 051 — notificações passam a guardar chave + parâmetros, não texto
--
-- As mensagens dos nove tipos eram construídas aqui, em português, no momento
-- em que o evento acontecia. A app é bilingue desde 19 de agosto, mas quem a
-- tem em inglês recebia "João deu-te um boost!" na mesma — na lista e no push.
--
-- É o mesmo problema que a 041 resolveu nos planos de treino, e a solução é a
-- mesma: guardar a chave e os parâmetros, e traduzir no momento de mostrar.
--
-- ── O que torna isto diferente da 041 ──────────────────────────────────────
--
-- Um plano de treino só se vê dentro da app, portanto bastava traduzir no
-- cliente. Uma notificação aparece em dois sítios: na lista, dentro da app, e
-- no ecrã bloqueado, desenhada pelo sistema operativo a partir do que a edge
-- function enviou. O sistema não sabe traduzir nada.
--
-- Por isso são precisas duas traduções, e o servidor precisa de saber o idioma
-- de cada pessoa. Daí a coluna `profiles.language`: a `send-push` já lê essa
-- linha para ir buscar o token e as preferências, portanto sai de graça, sem
-- uma única consulta a mais.
--
-- ── Porque é que a coluna `message` continua a ser preenchida ──────────────
--
-- Porque há builds instaladas que só sabem ler `message`. Se estas funções
-- deixassem de a escrever, essas pessoas passavam a ver notificações em
-- branco. Fica a ser o recurso: a app nova prefere `message_key`, a antiga
-- continua a ler o texto, e as linhas antigas — que não têm chave — continuam
-- a aparecer em português, como sempre apareceram. Ninguém regride.
--
-- É o mesmo critério da 041, onde os labels não convertidos continuavam a
-- funcionar.

-- ── 1. Idioma no perfil ────────────────────────────────────────────────────
-- A app escreve isto ao registar e sempre que se muda o idioma nas Definições.
-- O 'pt' por omissão é deliberado: é o mercado da app, e é o que as linhas
-- existentes já tinham de facto.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'pt'
  CHECK (language IN ('pt', 'en'));

COMMENT ON COLUMN public.profiles.language IS
  'Idioma da app (pt/en). Lido pela edge function send-push para traduzir o push — o sistema operativo não traduz nada.';

-- ── 2. Chave e parâmetros na notificação ───────────────────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS message_key TEXT,
  ADD COLUMN IF NOT EXISTS message_params JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.notifications.message_key IS
  'Chave de tradução (notif_kudo, notif_follow, ...). NULL nas linhas anteriores à 051, que caem no texto de message.';
COMMENT ON COLUMN public.notifications.message_params IS
  'Parâmetros da interpolação: {"actor":"João"}. Só conteúdo do utilizador — nomes, títulos, contagens. Nunca texto traduzível.';

-- ── 3. As nove funções ─────────────────────────────────────────────────────
-- Cada uma passa a escrever três coisas: a chave, os parâmetros, e o texto
-- português de sempre na `message`.

-- 3.1 follow
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_actor_name TEXT;
BEGIN
  v_actor_name := get_actor_display_name(NEW.follower_id);

  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message, message_key, message_params)
  VALUES (NEW.following_id, 'follow', NEW.follower_id, NEW.follower_id,
          v_actor_name || ' comecou a seguir-te!',
          'notif_follow', jsonb_build_object('actor', v_actor_name));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.2 kudo (boost)
-- A atribuição do crachá social_5_kudos vai junto porque estava na mesma
-- função — não é alteração nova, é a função inteira reescrita.
CREATE OR REPLACE FUNCTION after_kudo_insert()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_activity_user_id UUID;
  v_kudo_count INTEGER;
  v_actor_name TEXT;
BEGIN
  SELECT user_id INTO v_activity_user_id FROM public.activities WHERE id = NEW.activity_id;
  SELECT COUNT(*) INTO v_kudo_count FROM public.kudos WHERE activity_id = NEW.activity_id;

  IF v_kudo_count >= 5 THEN
    INSERT INTO public.user_badges (user_id, badge_id, activity_id)
    VALUES (v_activity_user_id, 'social_5_kudos', NEW.activity_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_activity_user_id IS NOT NULL AND v_activity_user_id <> NEW.user_id THEN
    v_actor_name := get_actor_display_name(NEW.user_id);
    INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message, message_key, message_params)
    VALUES (v_activity_user_id, 'kudo', NEW.user_id, NEW.activity_id,
            v_actor_name || ' deu-te um boost!',
            'notif_kudo', jsonb_build_object('actor', v_actor_name));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.3 comment
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_activity_user_id UUID;
  v_actor_name TEXT;
BEGIN
  SELECT user_id INTO v_activity_user_id FROM public.activities WHERE id = NEW.activity_id;

  IF v_activity_user_id IS NOT NULL AND v_activity_user_id <> NEW.user_id THEN
    v_actor_name := get_actor_display_name(NEW.user_id);
    INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message, message_key, message_params)
    VALUES (v_activity_user_id, 'comment', NEW.user_id, NEW.activity_id,
            v_actor_name || ' comentou na tua atividade.',
            'notif_comment', jsonb_build_object('actor', v_actor_name));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.4 badge
-- ⚠️ O nome do crachá vem da tabela `badges`, onde está em português. Vai como
-- parâmetro, portanto um utilizador inglês recebe "You unlocked the badge:
-- Madrugador!" — a frase traduz, o nome não. Traduzir os crachás é outro
-- trabalho (a tabela precisava de chaves, como a 041 fez nos planos) e não se
-- resolve aqui sem deixar a lista com dois comportamentos.
CREATE OR REPLACE FUNCTION notify_on_badge_earned()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_badge_name TEXT;
BEGIN
  v_badge_name := get_badge_name(NEW.badge_id);

  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message, message_key, message_params)
  VALUES (NEW.user_id, 'badge', NULL, NEW.id,
          'Desbloqueaste o cracha: ' || v_badge_name || '!',
          'notif_badge', jsonb_build_object('badge', v_badge_name));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.5 streak
-- O número vai como parâmetro e não dentro do texto: em inglês a frase muda de
-- ordem, e uma chave por marco (5, 10, 14, 21, 50, 100) seriam seis chaves para
-- dizer a mesma coisa.
CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID, p_activity_date DATE)
RETURNS void
SECURITY DEFINER
AS $$
DECLARE
  v_streak public.streaks;
  v_diff INTEGER;
  v_new_streak INTEGER;
  v_milestones INTEGER[] := ARRAY[5, 10, 14, 21, 50, 100];
  v_m INTEGER;
BEGIN
  SELECT * INTO v_streak FROM public.streaks WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (p_user_id, 1, 1, p_activity_date);
    v_new_streak := 1;
  ELSE
    v_diff := p_activity_date - v_streak.last_activity_date;

    IF v_diff = 1 THEN
      UPDATE public.streaks
      SET current_streak = current_streak + 1,
          longest_streak = GREATEST(longest_streak, current_streak + 1),
          last_activity_date = p_activity_date,
          updated_at = NOW()
      WHERE user_id = p_user_id;
      v_new_streak := v_streak.current_streak + 1;
    ELSIF v_diff = 0 THEN
      UPDATE public.streaks
      SET last_activity_date = p_activity_date, updated_at = NOW()
      WHERE user_id = p_user_id;
      v_new_streak := v_streak.current_streak;
    ELSE
      UPDATE public.streaks
      SET current_streak = 1,
          last_activity_date = p_activity_date,
          updated_at = NOW()
      WHERE user_id = p_user_id;
      v_new_streak := 1;
    END IF;
  END IF;

  FOREACH v_m IN ARRAY v_milestones
  LOOP
    IF v_new_streak = v_m THEN
      INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message, message_key, message_params)
      VALUES (p_user_id, 'streak', NULL, NULL,
              v_m || ' dias de sequencia! Continua assim!',
              'notif_streak', jsonb_build_object('days', v_m));
      EXIT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3.6 club_request
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

  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message, message_key, message_params)
  SELECT DISTINCT destinatario, 'club_request', NEW.user_id, NEW.club_id,
         COALESCE(v_nome, 'Alguém') || ' pediu para entrar em ' || COALESCE(v_clube, 'um clube') || '.',
         'notif_club_request',
         -- O fallback de nome e de clube fica em português dentro do parâmetro.
         -- É o caso raro (perfil apagado a meio) e não vale uma chave só para
         -- ele; o resto da frase traduz na mesma.
         jsonb_build_object('actor', COALESCE(v_nome, 'Alguém'),
                            'club',  COALESCE(v_clube, 'um clube'))
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

-- 3.7 club_accepted
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

  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message, message_key, message_params)
  VALUES (NEW.user_id, 'club_accepted', NEW.resolved_by, NEW.club_id,
          'Já fazes parte de ' || COALESCE(v_clube, 'um clube') || '.',
          'notif_club_accepted',
          jsonb_build_object('club', COALESCE(v_clube, 'um clube')));

  RETURN NEW;
END;
$$;

-- 3.8 message (direta)
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
  v_corpo text;
BEGIN
  SELECT full_name INTO v_nome FROM public.profiles WHERE id = NEW.sender_id;

  -- O corpo vai truncado: a pré-visualização do sistema já corta, e uma
  -- mensagem longa inteira dentro da linha da lista não se lê.
  v_corpo := CASE WHEN char_length(NEW.body) > 80
                  THEN left(NEW.body, 77) || '...'
                  ELSE NEW.body END;

  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message, message_key, message_params)
  SELECT p.user_id, 'message', NEW.sender_id, NEW.conversation_id,
         COALESCE(v_nome, 'Alguém') || ': ' || v_corpo,
         'notif_message',
         jsonb_build_object('actor', COALESCE(v_nome, 'Alguém'), 'preview', v_corpo)
  FROM public.conversation_participants p
  WHERE p.conversation_id = NEW.conversation_id
    AND p.user_id <> NEW.sender_id;

  RETURN NEW;
END;
$$;

-- 3.9 event
-- A data vai em ISO, não formatada, para quem mostra a formatar com o locale
-- de quem lê.
--
-- Em rigor, hoje isto não muda nada visível: o inglês da app é en-GB, que
-- escreve DD/MM tal como o português. O que muda é que o formato deixa de
-- estar congelado dentro da base de dados — no dia em que houver en-US ou
-- outro idioma, `14/09` deixa de ser lido como 9 de setembro sem ninguém ter
-- de reescrever gatilhos, e as linhas já gravadas ajustam-se sozinhas.
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

  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message, message_key, message_params)
  SELECT m.user_id, 'event', NEW.created_by, NEW.club_id,
         COALESCE(v_clube, 'Um clube') || ': ' || NEW.title ||
         ' · ' || to_char(NEW.starts_at AT TIME ZONE 'Europe/Lisbon', 'DD/MM HH24:MI'),
         'notif_event',
         jsonb_build_object('club',      COALESCE(v_clube, 'Um clube'),
                            'title',     NEW.title,
                            'starts_at', to_char(NEW.starts_at AT TIME ZONE 'UTC',
                                                 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  FROM public.club_members m
  WHERE m.club_id = NEW.club_id
    AND m.user_id <> NEW.created_by;

  RETURN NEW;
END;
$$;
