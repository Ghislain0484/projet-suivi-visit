-- Optimize get_user_role by making it STABLE
-- This allows the query planner to cache the result per query, avoiding thousands of profiles lookup subqueries in RLS policies.

CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = user_id),
    'collaborator'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Allow users to insert their own medical appointments
DROP POLICY IF EXISTS "med_appt_insert" ON public.medical_appointments;
CREATE POLICY "med_appt_insert" ON public.medical_appointments 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Reload postgrest schema cache
NOTIFY pgrst, 'reload schema';

