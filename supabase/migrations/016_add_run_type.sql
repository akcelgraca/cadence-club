-- Add run_type column to activities table
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS run_type TEXT;
COMMENT ON COLUMN public.activities.run_type IS 'Sub-type for runs: road or trail';
