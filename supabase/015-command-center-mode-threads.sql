-- Phase B1: mode-specific command center threads
-- Run after 014-command-center-foundation.sql

CREATE UNIQUE INDEX IF NOT EXISTS command_center_pre_trade_thread_idx
  ON public.command_center_threads (user_id, focus_id)
  WHERE focus_type = 'pre_trade' AND focus_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS command_center_post_trade_thread_idx
  ON public.command_center_threads (user_id, focus_id)
  WHERE focus_type = 'post_trade' AND focus_id IS NOT NULL;
