-- Create the avatars storage bucket
-- This must exist before the RLS policies in 020_add_avatar_storage.sql can work

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB max file size
  '{image/jpeg,image/png,image/webp,image/gif}'
);
