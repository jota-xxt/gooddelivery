
-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is participant in a delivery
CREATE OR REPLACE FUNCTION public.is_delivery_participant(_user_id UUID, _delivery_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deliveries d
    JOIN public.drivers dr ON dr.id = d.driver_id
    WHERE d.id = _delivery_id AND dr.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.deliveries d
    JOIN public.establishments e ON e.id = d.establishment_id
    WHERE d.id = _delivery_id AND e.user_id = _user_id
  )
$$;

-- SELECT policy
CREATE POLICY "Participants can view chat messages"
ON public.chat_messages
FOR SELECT
USING (public.is_delivery_participant(auth.uid(), delivery_id));

-- INSERT policy
CREATE POLICY "Participants can send chat messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_delivery_participant(auth.uid(), delivery_id)
);

-- Admin policy
CREATE POLICY "Admins can view all chat messages"
ON public.chat_messages
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
