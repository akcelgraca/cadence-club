-- 037_activity_photos.sql
-- Galeria de fotos por atividade (antes era uma única coluna photo_url).
--
-- activity_photos passa a ser a fonte de verdade. A coluna activities.photo_url
-- mantém-se como capa (primeira foto), atualizada por trigger — assim o feed,
-- os cartões e o código antigo continuam a funcionar sem alterações.

CREATE TABLE IF NOT EXISTS public.activity_photos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid        NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  url         text        NOT NULL,
  position    int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_photos_activity_idx
  ON public.activity_photos(activity_id, position);

ALTER TABLE public.activity_photos ENABLE ROW LEVEL SECURITY;

-- ── RLS: espelha exatamente a visibilidade das atividades ────────────────────
-- Colunas qualificadas de propósito: `activity_id` sem prefixo resolveria para
-- a tabela interior em subqueries.

CREATE POLICY "activity_photos_select" ON public.activity_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_photos.activity_id
        AND (
          a.is_public = true
          OR a.user_id = auth.uid()
          OR a.user_id IN (
            SELECT following_id FROM public.follows WHERE follower_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "activity_photos_insert" ON public.activity_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_photos.activity_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "activity_photos_update" ON public.activity_photos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_photos.activity_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "activity_photos_delete" ON public.activity_photos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_photos.activity_id AND a.user_id = auth.uid()
    )
  );

-- ── Capa sincronizada ────────────────────────────────────────────────────────

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
    ORDER BY p.position, p.created_at
    LIMIT 1
  )
  WHERE id = target_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_cover_photo ON public.activity_photos;
CREATE TRIGGER trg_activity_cover_photo
  AFTER INSERT OR UPDATE OR DELETE ON public.activity_photos
  FOR EACH ROW EXECUTE FUNCTION public.sync_activity_cover_photo();

-- ── Migrar as fotos que já existiam ──────────────────────────────────────────

INSERT INTO public.activity_photos (activity_id, url, position)
SELECT a.id, a.photo_url, 0
FROM public.activities a
WHERE a.photo_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.activity_photos p WHERE p.activity_id = a.id
  );
