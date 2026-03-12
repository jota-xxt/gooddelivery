
-- Fix chat_messages RLS: change from {public} to {authenticated}
DROP POLICY IF EXISTS "Admins can view all chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Participants can send chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Participants can view chat messages" ON public.chat_messages;

CREATE POLICY "Admins can view all chat messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants can send chat messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = sender_id) AND is_delivery_participant(auth.uid(), delivery_id));

CREATE POLICY "Participants can view chat messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (is_delivery_participant(auth.uid(), delivery_id));
