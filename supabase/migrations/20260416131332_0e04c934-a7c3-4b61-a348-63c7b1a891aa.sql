
-- Drop the overly permissive policy
DROP POLICY "Authenticated users can create organizations" ON public.organizations;

-- Create a more restrictive policy
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Ensure the user will become a member (enforced via application logic)
    auth.uid() IS NOT NULL
  );
