CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON public.deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_drivers_online_queue ON public.drivers(is_online, queue_joined_at);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_delivery_status ON public.delivery_offers(delivery_id, status);