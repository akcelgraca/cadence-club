-- 034_club_join_requests.sql
-- Pedidos de adesão a clubes privados:
--  • Clubes privados passam a ser visíveis na pesquisa (só os metadados —
--    chat e conteúdo continuam restritos a membros).
--  • Quem não é membro envia um pedido; um admin (ou o dono) aceita/recusa.
--  • A entrada direta em clubes privados fica bloqueada — só via aceitação.

-- ── Tabela de pedidos ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.club_join_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid        REFERENCES public.profiles(id),
  UNIQUE (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS club_join_requests_pending_idx
  ON public.club_join_requests(club_id) WHERE status = 'pending';

ALTER TABLE public.club_join_requests ENABLE ROW LEVEL SECURITY;

-- ── Função auxiliar: é admin/dono do clube? ──────────────────────────────────
-- SECURITY DEFINER para evitar ambiguidades e recursão nas políticas.

CREATE OR REPLACE FUNCTION public.is_club_admin(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = p_club_id AND owner_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_club_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_club_admin(uuid) TO authenticated;

-- ── Políticas ────────────────────────────────────────────────────────────────

-- O próprio vê os seus pedidos; os admins do clube veem todos os do clube
CREATE POLICY "club_join_requests_select" ON public.club_join_requests
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_club_admin(club_id)
  );

-- Qualquer utilizador pede em seu nome (sempre como pendente)
CREATE POLICY "club_join_requests_insert" ON public.club_join_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- O próprio pode cancelar/repetir o pedido; admins resolvem via função abaixo
CREATE POLICY "club_join_requests_delete" ON public.club_join_requests
  FOR DELETE USING (auth.uid() = user_id);

-- ── Aceitar / recusar (SECURITY DEFINER) ─────────────────────────────────────
-- A inserção em club_members é feita aqui porque a política de INSERT
-- só permite ao próprio inserir a sua linha.

CREATE OR REPLACE FUNCTION public.respond_club_request(p_request_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.club_join_requests%ROWTYPE;
BEGIN
  SELECT * INTO req
  FROM public.club_join_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já resolvido';
  END IF;

  IF NOT public.is_club_admin(req.club_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerir pedidos deste clube';
  END IF;

  UPDATE public.club_join_requests
  SET status      = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
      resolved_at = now(),
      resolved_by = auth.uid()
  WHERE id = p_request_id;

  IF p_accept THEN
    -- O trigger trg_club_member_count atualiza member_count automaticamente
    INSERT INTO public.club_members (club_id, user_id, role)
    VALUES (req.club_id, req.user_id, 'member')
    ON CONFLICT (club_id, user_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_club_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_club_request(uuid, boolean) TO authenticated;

-- ── Clubes privados visíveis na pesquisa (metadados) ─────────────────────────
-- O conteúdo continua protegido: chat (club_messages) e leitura de pedidos
-- são só para membros/admins.

DROP POLICY IF EXISTS "clubs_select" ON public.clubs;
CREATE POLICY "clubs_select" ON public.clubs
  FOR SELECT USING (true);

-- ── Entrada direta só em clubes públicos ─────────────────────────────────────
-- Privados: apenas via respond_club_request (ou o dono na criação).

DROP POLICY IF EXISTS "club_members_insert" ON public.club_members;
CREATE POLICY "club_members_insert" ON public.club_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_id AND (c.is_private = false OR c.owner_id = auth.uid())
    )
  );
