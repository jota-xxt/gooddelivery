
-- Fix deliveries RLS policies: convert from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Admins can update all deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Admins can view all deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Driver can view assigned deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can accept searching deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can update assigned deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Establishment can view own deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Establishments can create deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Online drivers can view searching deliveries" ON public.deliveries;

CREATE POLICY "Admins can update all deliveries" ON public.deliveries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all deliveries" ON public.deliveries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Driver can view assigned deliveries" ON public.deliveries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM drivers d WHERE d.id = deliveries.driver_id AND d.user_id = auth.uid()));
CREATE POLICY "Drivers can accept searching deliveries" ON public.deliveries FOR UPDATE TO authenticated USING (status = 'searching'::delivery_status AND public.has_role(auth.uid(), 'driver'::app_role));
CREATE POLICY "Drivers can update assigned deliveries" ON public.deliveries FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM drivers d WHERE d.id = deliveries.driver_id AND d.user_id = auth.uid()));
CREATE POLICY "Establishment can view own deliveries" ON public.deliveries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM establishments e WHERE e.id = deliveries.establishment_id AND e.user_id = auth.uid()));
CREATE POLICY "Establishments can create deliveries" ON public.deliveries FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM establishments e WHERE e.id = deliveries.establishment_id AND e.user_id = auth.uid()));
CREATE POLICY "Online drivers can view searching deliveries" ON public.deliveries FOR SELECT TO authenticated USING (status = 'searching'::delivery_status AND public.has_role(auth.uid(), 'driver'::app_role));

-- Fix app_settings RLS policies
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone authenticated can read settings" ON public.app_settings;

CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone authenticated can read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);

-- Fix delivery_offers RLS policies
DROP POLICY IF EXISTS "Admins can manage offers" ON public.delivery_offers;
DROP POLICY IF EXISTS "Admins can view all offers" ON public.delivery_offers;
DROP POLICY IF EXISTS "Drivers can view own offers" ON public.delivery_offers;

CREATE POLICY "Admins can manage offers" ON public.delivery_offers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all offers" ON public.delivery_offers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Drivers can view own offers" ON public.delivery_offers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM drivers d WHERE d.id = delivery_offers.driver_id AND d.user_id = auth.uid()));

-- Fix drivers RLS policies
DROP POLICY IF EXISTS "Admins can update drivers" ON public.drivers;
DROP POLICY IF EXISTS "Admins can view all drivers" ON public.drivers;
DROP POLICY IF EXISTS "Driver can update own data" ON public.drivers;
DROP POLICY IF EXISTS "Driver can view own data" ON public.drivers;
DROP POLICY IF EXISTS "Establishments can view online drivers" ON public.drivers;
DROP POLICY IF EXISTS "Users can insert own driver" ON public.drivers;

CREATE POLICY "Admins can update drivers" ON public.drivers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all drivers" ON public.drivers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Driver can update own data" ON public.drivers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Driver can view own data" ON public.drivers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Establishments can view online drivers" ON public.drivers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'establishment'::app_role));
CREATE POLICY "Users can insert own driver" ON public.drivers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Fix establishments RLS policies
DROP POLICY IF EXISTS "Admins can update establishments" ON public.establishments;
DROP POLICY IF EXISTS "Admins can view all establishments" ON public.establishments;
DROP POLICY IF EXISTS "Drivers can view establishments for deliveries" ON public.establishments;
DROP POLICY IF EXISTS "Establishment can update own data" ON public.establishments;
DROP POLICY IF EXISTS "Establishment can view own data" ON public.establishments;
DROP POLICY IF EXISTS "Users can insert own establishment" ON public.establishments;

CREATE POLICY "Admins can update establishments" ON public.establishments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all establishments" ON public.establishments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Drivers can view establishments for deliveries" ON public.establishments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'driver'::app_role));
CREATE POLICY "Establishment can update own data" ON public.establishments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Establishment can view own data" ON public.establishments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own establishment" ON public.establishments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Fix financial_weekly_reports RLS policies
DROP POLICY IF EXISTS "Admins can update reports" ON public.financial_weekly_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON public.financial_weekly_reports;
DROP POLICY IF EXISTS "Users can view own reports" ON public.financial_weekly_reports;

CREATE POLICY "Admins can update reports" ON public.financial_weekly_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all reports" ON public.financial_weekly_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own reports" ON public.financial_weekly_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Fix notifications RLS policies
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Fix profiles RLS policies
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Fix ratings RLS policies
DROP POLICY IF EXISTS "Admins can view all ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users can create ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users can view ratings about them" ON public.ratings;

CREATE POLICY "Admins can view all ratings" ON public.ratings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create ratings" ON public.ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can view ratings about them" ON public.ratings FOR SELECT TO authenticated USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

-- Fix user_roles RLS policies
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
