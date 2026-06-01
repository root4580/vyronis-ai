-- Add Jarvis master coordinator voice column to council_settings.
ALTER TABLE public.council_settings
  ADD COLUMN IF NOT EXISTS jarvis_voice_id text;
