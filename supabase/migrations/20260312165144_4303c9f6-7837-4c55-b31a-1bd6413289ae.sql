CREATE POLICY "Drivers can view other driver profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role)
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = profiles.user_id AND ur.role = 'driver'::app_role
  )
);