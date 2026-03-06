
-- Add queue_joined_at to drivers
ALTER TABLE public.drivers ADD COLUMN queue_joined_at timestamp with time zone;

-- Create delivery_offer_status enum
CREATE TYPE public.delivery_offer_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- Create delivery_offers table
CREATE TABLE public.delivery_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  offered_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  status delivery_offer_status NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_offers ENABLE ROW LEVEL SECURITY;

-- RLS: Drivers can view their own offers
CREATE POLICY "Drivers can view own offers" ON public.delivery_offers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = delivery_offers.driver_id AND d.user_id = auth.uid())
  );

-- RLS: Admins can view all offers
CREATE POLICY "Admins can view all offers" ON public.delivery_offers
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Admins can manage all offers
CREATE POLICY "Admins can manage offers" ON public.delivery_offers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for delivery_offers
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_offers;

-- Insert delivery_mode setting
INSERT INTO public.app_settings (key, value) VALUES ('delivery_mode', 'pool');
