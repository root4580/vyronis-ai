-- Run this in Supabase SQL Editor to fix trade screenshot uploads.
-- The app expects bucket name: trade-screenshots
-- (override with NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET in .env.local if needed)

-- 1) Create public storage bucket (required for getPublicUrl in the app)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Ensure trades table can store the uploaded URL
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS screenshot_url text;

-- 3) Storage policies (files are stored as: {user_id}/{timestamp}-{random}.{ext})
DROP POLICY IF EXISTS "Trade screenshots: authenticated upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "Trade screenshots: public read" ON storage.objects;
DROP POLICY IF EXISTS "Trade screenshots: authenticated update own folder" ON storage.objects;
DROP POLICY IF EXISTS "Trade screenshots: authenticated delete own folder" ON storage.objects;

CREATE POLICY "Trade screenshots: authenticated upload own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Trade screenshots: public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'trade-screenshots');

CREATE POLICY "Trade screenshots: authenticated update own folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trade-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Trade screenshots: authenticated delete own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'trade-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
