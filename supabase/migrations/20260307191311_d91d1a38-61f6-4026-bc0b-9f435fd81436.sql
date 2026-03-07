
-- Enable realtime for app_settings so drivers receive mode changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

-- Enable pg_cron and pg_net for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
