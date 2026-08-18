-- 028_fix_conversation_rls.sql
-- Corrige as políticas RLS de mensagens diretas.
--
-- Problema 1 (recursão): a política conv_participants_select consultava a
-- própria tabela conversation_participants dentro do USING, o que o Postgres
-- rejeita em runtime com "infinite recursion detected in policy" (42P17).
-- Qualquer query a conversas/mensagens que tocasse nesta tabela falhava.
--
-- Problema 2 (fuga de dados): na subquery `WHERE cp.conversation_id =
-- conversation_id`, ambas as colunas resolvem para o alias interno `cp`,
-- tornando a condição sempre verdadeira — qualquer participante de qualquer
-- conversa veria os participantes de todas as conversas.
--
-- Problema 3 (escrita aberta): conv_participants_insert permitia a qualquer
-- utilizador autenticado adicionar-se (ou adicionar terceiros) a qualquer
-- conversa, ganhando acesso de leitura às mensagens.
--
-- Solução: função SECURITY DEFINER que verifica a participação sem passar
-- pelo RLS (quebra o ciclo) e políticas reescritas a usá-la.

-- ── Função auxiliar ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = conv_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_conversation_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated;

-- ── conversations ────────────────────────────────────────────────────────────
-- created_by permite ao criador ver a conversa acabada de criar (o INSERT ...
-- RETURNING corre antes de existirem participantes, e o RETURNING é filtrado
-- pela política de SELECT).

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id);

DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING (
    created_by = auth.uid()
    OR public.is_conversation_participant(id)
  );

DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE USING (public.is_conversation_participant(id));

-- ── conversation_participants ────────────────────────────────────────────────

DROP POLICY IF EXISTS "conv_participants_select" ON public.conversation_participants;
CREATE POLICY "conv_participants_select" ON public.conversation_participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
  );

-- Podes adicionar-te a ti próprio, ou adicionar outra pessoa a uma conversa
-- em que já participas (o cliente insere primeiro a própria linha).
DROP POLICY IF EXISTS "conv_participants_insert" ON public.conversation_participants;
CREATE POLICY "conv_participants_insert" ON public.conversation_participants
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
  );

-- ── messages ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_participant(conversation_id)
  );

DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE USING (public.is_conversation_participant(conversation_id));
