-- Add height_cm column to profiles table for fitness metrics
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm REAL;
COMMENT ON COLUMN public.profiles.height_cm IS 'User height in centimeters (for calorie/metabolism calculations)';
