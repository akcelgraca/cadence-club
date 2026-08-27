-- 053 — os crachás passam a guardar chaves, não texto
--
-- Mesmo problema que a 041 resolveu nos planos de treino e a 051 nas
-- notificações: `badges.name` e `badges.description` guardavam português, e
-- português é o que toda a gente via — incluindo quem tem a app em inglês.
--
-- Ficou por fazer na 051 de propósito: o nome do crachá ia como *parâmetro* da
-- notificação, e um inglês recebia "You unlocked the badge: Madrugador!". A
-- frase traduzia, o nome não.
--
-- ── Porque é que a chave não é derivada do id ───────────────────────────────
--
-- O `id` já é estável (`first_activity`, `streak_3`) e dava para construir a
-- chave em código. Guardá-la na coluna é o que mantém isto igual à 041 e à 051,
-- e sobretudo é o que permite acrescentar um crachá sem tocar em código de
-- cliente: quem insere a linha escolhe a chave.
--
-- ── O que isto obriga do outro lado ─────────────────────────────────────────
--
-- O gatilho `notify_on_badge_earned` passa a mandar a **chave** no parâmetro
-- `badge`. Quem mostra tem de a traduzir antes de interpolar — na app e também
-- na edge function `send-push`, que desenha o texto do push e não tem i18next.

UPDATE public.badges SET
  name = 'badge_' || id,
  description = 'badge_' || id || '_desc'
WHERE name NOT LIKE 'badge\_%';

COMMENT ON COLUMN public.badges.name IS
  'Chave de tradução (badge_early_bird). Resolvida por quem mostra — nunca guardar texto visível aqui.';
COMMENT ON COLUMN public.badges.description IS
  'Chave de tradução (badge_early_bird_desc). Ver o comentário de name.';

-- O gatilho continua igual no resto; o que muda é o que `get_badge_name`
-- devolve, que agora é uma chave. Fica escrito no corpo para não parecer
-- descuido a quem o ler daqui a uns meses.
CREATE OR REPLACE FUNCTION notify_on_badge_earned()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_badge_key TEXT;
BEGIN
  -- Desde a 053 isto é uma CHAVE (`badge_early_bird`), não um nome. Quem
  -- mostra a notificação traduz antes de a interpolar em `notif_badge`.
  v_badge_key := get_badge_name(NEW.badge_id);

  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, message, message_key, message_params)
  VALUES (NEW.user_id, 'badge', NULL, NEW.id,
          -- A coluna `message` continua a levar português para as builds
          -- antigas, que só sabem ler isso. Ver o cabeçalho da 051.
          'Desbloqueaste um cracha!',
          'notif_badge', jsonb_build_object('badge', v_badge_key));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
