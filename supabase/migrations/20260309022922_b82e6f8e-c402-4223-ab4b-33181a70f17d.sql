-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'technician');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'technician',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create tempo_submissions table
CREATE TABLE public.tempo_submissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    technician_email TEXT NOT NULL,
    technician_name TEXT NOT NULL,
    upsell_amount DECIMAL(10, 2) NOT NULL,
    submission_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    uploaded_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create sendoso_records table
CREATE TABLE public.sendoso_records (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    technician_email TEXT NOT NULL,
    technician_name TEXT NOT NULL,
    reward_amount DECIMAL(10, 2) NOT NULL,
    fulfillment_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'fulfilled',
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    uploaded_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tempo_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sendoso_records ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Tempo submissions policies
CREATE POLICY "Users can view their own tempo submissions"
ON public.tempo_submissions FOR SELECT
USING (LOWER(technician_email) = LOWER((SELECT email FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Admins can view all tempo submissions"
ON public.tempo_submissions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert tempo submissions"
ON public.tempo_submissions FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tempo submissions"
ON public.tempo_submissions FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Sendoso records policies
CREATE POLICY "Users can view their own sendoso records"
ON public.sendoso_records FOR SELECT
USING (LOWER(technician_email) = LOWER((SELECT email FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Admins can view all sendoso records"
ON public.sendoso_records FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert sendoso records"
ON public.sendoso_records FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sendoso records"
ON public.sendoso_records FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-create profile and assign technician role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'technician');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();