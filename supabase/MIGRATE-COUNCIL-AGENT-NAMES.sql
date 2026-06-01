-- Rename council agents in existing Supabase data.
-- Run once after deploying the Nova / Rex / Luna / Cipher / Zara rename.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'council_settings'
      AND column_name = 'sarah_voice_id'
  ) THEN
    ALTER TABLE public.council_settings RENAME COLUMN sarah_voice_id TO nova_voice_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'council_settings'
      AND column_name = 'adam_voice_id'
  ) THEN
    ALTER TABLE public.council_settings RENAME COLUMN adam_voice_id TO zara_voice_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'council_settings'
      AND column_name = 'scott_voice_id'
  ) THEN
    ALTER TABLE public.council_settings RENAME COLUMN scott_voice_id TO rex_voice_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'council_settings'
      AND column_name = 'hamza_voice_id'
  ) THEN
    ALTER TABLE public.council_settings RENAME COLUMN hamza_voice_id TO luna_voice_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'council_settings'
      AND column_name = 'khalid_voice_id'
  ) THEN
    ALTER TABLE public.council_settings RENAME COLUMN khalid_voice_id TO cipher_voice_id;
  END IF;
END $$;

UPDATE public.agent_memories SET agent_name = 'nova' WHERE agent_name = 'sarah';
UPDATE public.agent_memories SET agent_name = 'zara' WHERE agent_name = 'adam';
UPDATE public.agent_memories SET agent_name = 'rex' WHERE agent_name = 'scott';
UPDATE public.agent_memories SET agent_name = 'luna' WHERE agent_name = 'hamza';
UPDATE public.agent_memories SET agent_name = 'cipher' WHERE agent_name = 'khalid';

UPDATE public.council_sessions
SET agents_spoken = ARRAY(
  SELECT CASE name
    WHEN 'Sarah' THEN 'Nova'
    WHEN 'Adam' THEN 'Zara'
    WHEN 'Emma' THEN 'Zara'
    WHEN 'Scott' THEN 'Rex'
    WHEN 'Hamza' THEN 'Luna'
    WHEN 'Layla' THEN 'Luna'
    WHEN 'Khalid' THEN 'Cipher'
    ELSE name
  END
  FROM unnest(agents_spoken) AS name
);

UPDATE public.council_sessions
SET full_transcript = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN elem->>'agent' = 'sarah' THEN jsonb_set(elem, '{agent}', '"nova"')
        WHEN elem->>'agent' = 'adam' THEN jsonb_set(elem, '{agent}', '"zara"')
        WHEN elem->>'agent' = 'scott' THEN jsonb_set(elem, '{agent}', '"rex"')
        WHEN elem->>'agent' = 'hamza' THEN jsonb_set(elem, '{agent}', '"luna"')
        WHEN elem->>'agent' = 'khalid' THEN jsonb_set(elem, '{agent}', '"cipher"')
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(full_transcript) AS elem
)
WHERE full_transcript IS NOT NULL;

NOTIFY pgrst, 'reload schema';
