
ALTER TABLE public.deliveries
  ADD COLUMN observations text,
  ADD COLUMN urgency text NOT NULL DEFAULT 'normal',
  ALTER COLUMN customer_name SET DEFAULT '',
  ALTER COLUMN customer_name DROP NOT NULL,
  ALTER COLUMN prep_time_minutes DROP NOT NULL;
