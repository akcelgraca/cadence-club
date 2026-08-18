-- 035_repair_owner_memberships.sql
-- Reparação de dados: donos de clubes sem linha de membro.
--
-- O createClub da app inseria a adesão do dono sem verificar o erro; se essa
-- inserção falhasse, o dono ficava sem membership — o próprio clube aparecia
-- em "Descobrir" e era possível criar um pedido de adesão ao próprio clube.

-- 1. Reinserir o dono como admin onde falta
INSERT INTO public.club_members (club_id, user_id, role)
SELECT c.id, c.owner_id, 'admin'
FROM public.clubs c
WHERE NOT EXISTS (
  SELECT 1 FROM public.club_members m
  WHERE m.club_id = c.id AND m.user_id = c.owner_id
)
ON CONFLICT (club_id, user_id) DO NOTHING;

-- 2. Remover pedidos de adesão feitos pelo próprio dono
DELETE FROM public.club_join_requests r
USING public.clubs c
WHERE r.club_id = c.id AND r.user_id = c.owner_id;

-- 3. Garantir que quem já é membro não tem pedidos pendentes pendurados
DELETE FROM public.club_join_requests r
USING public.club_members m
WHERE r.club_id = m.club_id AND r.user_id = m.user_id AND r.status = 'pending';

-- 4. Recalcular member_count (corrige também as contagens duplicadas antigas)
UPDATE public.clubs c
SET member_count = (
  SELECT count(*) FROM public.club_members m WHERE m.club_id = c.id
);
