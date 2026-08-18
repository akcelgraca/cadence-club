-- 038_generated_photos.sql
-- Marca as fotos criadas pela app (cartão de estatísticas com fundo
-- transparente, gerado ao terminar a atividade).
--
-- Precisam de tratamento diferente ao mostrar: são PNG transparentes com texto
-- branco, por isso vão sobre fundo escuro e em "contain" — sobre o fundo claro
-- dos cartões ficariam invisíveis.

ALTER TABLE public.activity_photos
  ADD COLUMN IF NOT EXISTS is_generated boolean NOT NULL DEFAULT false;

-- A capa deve ser sempre uma foto real do utilizador quando existir; o cartão
-- gerado só serve de capa se não houver mais nada.
CREATE OR REPLACE FUNCTION public.sync_activity_cover_photo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid := COALESCE(NEW.activity_id, OLD.activity_id);
BEGIN
  UPDATE public.activities
  SET photo_url = (
    SELECT p.url
    FROM public.activity_photos p
    WHERE p.activity_id = target_id
    ORDER BY p.is_generated, p.position, p.created_at
    LIMIT 1
  )
  WHERE id = target_id;
  RETURN NULL;
END;
$$;
