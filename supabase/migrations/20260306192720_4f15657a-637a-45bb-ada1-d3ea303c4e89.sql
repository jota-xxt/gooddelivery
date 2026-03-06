
-- Create enum for report payment status
CREATE TYPE public.report_payment_status AS ENUM ('pending', 'paid');

-- Create enum for entity type
CREATE TYPE public.financial_entity_type AS ENUM ('establishment', 'driver');

-- Create financial weekly reports table
CREATE TABLE public.financial_weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  week_end date NOT NULL,
  entity_type financial_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  total_deliveries integer NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  net_payout numeric NOT NULL DEFAULT 0,
  status report_payment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(week_start, entity_type, entity_id)
);

-- Enable RLS
ALTER TABLE public.financial_weekly_reports ENABLE ROW LEVEL SECURITY;

-- Users can view own reports
CREATE POLICY "Users can view own reports"
  ON public.financial_weekly_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON public.financial_weekly_reports
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update report status
CREATE POLICY "Admins can update reports"
  ON public.financial_weekly_reports
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
