-- Add surface_type and equipment_id columns to activities table
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS surface_type TEXT;
COMMENT ON COLUMN public.activities.surface_type IS 'Surface type: road, trail, mixed, or track';

ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.activities.equipment_id IS 'Equipment used during the activity (e.g. shoes, bike)';
