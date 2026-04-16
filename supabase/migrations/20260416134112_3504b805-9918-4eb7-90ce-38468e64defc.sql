
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('super_admin');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Service role manages all
CREATE POLICY "Service role manages roles"
  ON public.user_roles FOR ALL
  USING (auth.role() = 'service_role');

-- Security definer function to check super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Super admin can view ALL organizations
CREATE POLICY "Super admin can view all organizations"
  ON public.organizations FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin can update all organizations"
  ON public.organizations FOR UPDATE
  USING (public.is_super_admin(auth.uid()));

-- Super admin can view ALL profiles
CREATE POLICY "Super admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Super admin can view ALL org members
CREATE POLICY "Super admin can view all org members"
  ON public.organization_members FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Super admin can view ALL subscriptions
CREATE POLICY "Super admin can view all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Super admin can update all subscriptions
CREATE POLICY "Super admin can manage all subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (public.is_super_admin(auth.uid()));
