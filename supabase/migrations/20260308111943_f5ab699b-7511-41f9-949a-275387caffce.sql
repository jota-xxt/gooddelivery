CREATE POLICY "Establishments can view driver profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'establishment'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = profiles.user_id AND ur.role = 'driver'
  )
);