CREATE POLICY "Drivers can view other online drivers"
ON public.drivers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role)
  AND is_online = true
);