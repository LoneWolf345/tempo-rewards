
-- Create a security definer function to check is_active
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.profiles WHERE user_id = _user_id),
    false
  )
$$;

-- Update user-facing SELECT policies on tempo_submissions
DROP POLICY IF EXISTS "Users can view their own tempo submissions" ON public.tempo_submissions;
CREATE POLICY "Users can view their own tempo submissions"
ON public.tempo_submissions
FOR SELECT
TO public
USING (
  lower(technician_email) = lower((SELECT email FROM public.profiles WHERE user_id = auth.uid()))
  AND public.is_active_user(auth.uid())
);

-- Update user-facing SELECT policies on sendoso_records
DROP POLICY IF EXISTS "Users can view their own sendoso records" ON public.sendoso_records;
CREATE POLICY "Users can view their own sendoso records"
ON public.sendoso_records
FOR SELECT
TO public
USING (
  lower(technician_email) = lower((SELECT email FROM public.profiles WHERE user_id = auth.uid()))
  AND public.is_active_user(auth.uid())
);

-- Update user-facing SELECT policies on adjustments
DROP POLICY IF EXISTS "Users can view their own adjustments" ON public.adjustments;
CREATE POLICY "Users can view their own adjustments"
ON public.adjustments
FOR SELECT
TO public
USING (
  lower(technician_email) = lower((SELECT email FROM public.profiles WHERE user_id = auth.uid()))
  AND public.is_active_user(auth.uid())
);

-- Update user-facing SELECT policy on user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO public
USING (
  auth.uid() = user_id
  AND public.is_active_user(auth.uid())
);

-- Update user-facing SELECT policy on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO public
USING (
  auth.uid() = user_id
  AND public.is_active_user(auth.uid())
);
