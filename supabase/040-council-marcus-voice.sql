-- Add Marcus (personal trading psychologist) voice column to council_settings.
ALTER TABLE public.council_settings
  ADD COLUMN IF NOT EXISTS marcus_voice_id text;
