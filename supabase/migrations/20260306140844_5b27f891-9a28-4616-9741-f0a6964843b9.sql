
-- Enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'establishment', 'driver');

-- Enum for delivery status
CREATE TYPE public.delivery_status AS ENUM ('searching', 'accepted', 'collecting', 'delivering', 'completed', 'cancelled');

-- Enum for vehicle type
CREATE TYPE public.vehicle_type AS ENUM ('motorcycle', 'bicycle', 'car');

-- Enum for approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  status approval_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Establishments table
CREATE TABLE public.establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  responsible_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drivers table
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cpf TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_type vehicle_type NOT NULL,
  plate TEXT,
  is_online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deliveries table
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID REFERENCES public.establishments(id) NOT NULL,
  driver_id UUID REFERENCES public.drivers(id),
  customer_name TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  prep_time_minutes INTEGER NOT NULL DEFAULT 15,
  delivery_fee DECIMAL(10,2) NOT NULL,
  status delivery_status NOT NULL DEFAULT 'searching',
  accepted_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ratings table
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.deliveries(id) NOT NULL,
  from_user_id UUID REFERENCES auth.users(id) NOT NULL,
  to_user_id UUID REFERENCES auth.users(id) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App settings (for admin config like platform fee)
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user approval status
CREATE OR REPLACE FUNCTION public.get_user_status(_user_id UUID)
RETURNS approval_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.profiles WHERE user_id = _user_id
$$;

-- Handle new user signup - create profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'role')::app_role
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System inserts profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- USER ROLES policies
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System inserts roles" ON public.user_roles FOR INSERT WITH CHECK (true);

-- ESTABLISHMENTS policies
CREATE POLICY "Establishment can view own data" ON public.establishments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all establishments" ON public.establishments FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can view establishments for deliveries" ON public.establishments FOR SELECT USING (public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Users can insert own establishment" ON public.establishments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Establishment can update own data" ON public.establishments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update establishments" ON public.establishments FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- DRIVERS policies
CREATE POLICY "Driver can view own data" ON public.drivers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all drivers" ON public.drivers FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Establishments can view online drivers" ON public.drivers FOR SELECT USING (public.has_role(auth.uid(), 'establishment'));
CREATE POLICY "Users can insert own driver" ON public.drivers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Driver can update own data" ON public.drivers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update drivers" ON public.drivers FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- DELIVERIES policies
CREATE POLICY "Establishment can view own deliveries" ON public.deliveries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.user_id = auth.uid())
);
CREATE POLICY "Driver can view assigned deliveries" ON public.deliveries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
);
CREATE POLICY "Online drivers can view searching deliveries" ON public.deliveries FOR SELECT USING (
  status = 'searching' AND public.has_role(auth.uid(), 'driver')
);
CREATE POLICY "Admins can view all deliveries" ON public.deliveries FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Establishments can create deliveries" ON public.deliveries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.user_id = auth.uid())
);
CREATE POLICY "Drivers can update assigned deliveries" ON public.deliveries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
);
CREATE POLICY "Admins can update all deliveries" ON public.deliveries FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can accept searching deliveries" ON public.deliveries FOR UPDATE USING (
  status = 'searching' AND public.has_role(auth.uid(), 'driver')
);

-- RATINGS policies
CREATE POLICY "Users can view ratings about them" ON public.ratings FOR SELECT USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);
CREATE POLICY "Admins can view all ratings" ON public.ratings FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create ratings" ON public.ratings FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- APP SETTINGS policies
CREATE POLICY "Anyone authenticated can read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- NOTIFICATIONS policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_establishments_updated_at BEFORE UPDATE ON public.establishments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default app settings
INSERT INTO public.app_settings (key, value) VALUES ('platform_fee_percentage', '10');

-- Enable realtime for deliveries and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
