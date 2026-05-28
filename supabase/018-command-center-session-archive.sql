-- Command Center session archive: clean slate on each open, history preserved
-- Run after 017-autonomous-intelligence-foundation.sql

ALTER TABLE public.command_center_threads
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived'));

COMMENT ON COLUMN public.command_center_threads.status IS
  'active = current companion session; archived = closed session kept in history';

DROP INDEX IF EXISTS public.command_center_companion_thread_idx;

CREATE UNIQUE INDEX IF NOT EXISTS command_center_active_companion_thread_idx
  ON public.command_center_threads (user_id)
  WHERE focus_type = 'companion' AND status = 'active';

CREATE INDEX IF NOT EXISTS command_center_threads_user_archived_idx
  ON public.command_center_threads (user_id, updated_at DESC)
  WHERE focus_type = 'companion' AND status = 'archived';
