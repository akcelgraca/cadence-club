-- 029_club_chat.sql
-- Chat de grupo dos clubes (estilo WhatsApp, conforme spec do menu social).

CREATE TABLE IF NOT EXISTS public.club_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_messages_club_created_idx
  ON public.club_messages(club_id, created_at DESC);

ALTER TABLE public.club_messages ENABLE ROW LEVEL SECURITY;

-- Só membros do clube podem ler o chat.
-- (Sem recursão: a política de SELECT de club_members é USING (true).)
CREATE POLICY "club_messages_select" ON public.club_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_messages.club_id AND user_id = auth.uid()
    )
  );

-- Só membros podem escrever, e apenas em seu nome.
CREATE POLICY "club_messages_insert" ON public.club_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_messages.club_id AND user_id = auth.uid()
    )
  );

-- O autor apaga as suas mensagens; o dono do clube pode moderar.
CREATE POLICY "club_messages_delete" ON public.club_messages
  FOR DELETE USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT owner_id FROM public.clubs WHERE id = club_id)
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.club_messages;
