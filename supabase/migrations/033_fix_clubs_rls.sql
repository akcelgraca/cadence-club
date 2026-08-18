-- 033_fix_clubs_rls.sql
-- Corrige a política clubs_select da migração 027.
--
-- Na subquery `SELECT user_id FROM club_members WHERE club_id = id`, o `id`
-- resolve para club_members.id (coluna da tabela interior), não para clubs.id.
-- A condição comparava club_members.club_id = club_members.id — sempre falsa —
-- pelo que o ramo "membro" da política estava morto: membros de clubes
-- privados (exceto o dono) não conseguiam ver o próprio clube.

DROP POLICY IF EXISTS "clubs_select" ON public.clubs;
CREATE POLICY "clubs_select" ON public.clubs
  FOR SELECT USING (
    is_private = false
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = clubs.id AND m.user_id = auth.uid()
    )
  );
