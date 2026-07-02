-- 1. Update permissions table RLS policies
DROP POLICY IF EXISTS "permissions_select" ON public.permissions;
CREATE POLICY "permissions_select" ON public.permissions 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'service_manager'));

DROP POLICY IF EXISTS "permissions_update" ON public.permissions;
CREATE POLICY "permissions_update" ON public.permissions 
  FOR UPDATE TO authenticated 
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'service_manager'));

-- 2. Update missions table RLS policies
DROP POLICY IF EXISTS "missions_update" ON public.missions;
CREATE POLICY "missions_update" ON public.missions 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'service_manager'));

-- 3. Update invoices table RLS policies to allow receptionists to update and delete
DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
CREATE POLICY "invoices_update" ON public.invoices 
  FOR UPDATE TO authenticated 
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'accounting', 'cashier', 'reception', 'service_manager'));

DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
CREATE POLICY "invoices_delete" ON public.invoices 
  FOR DELETE TO authenticated 
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'accounting', 'reception', 'service_manager'));

-- Reload Postgrest schema cache
NOTIFY pgrst, 'reload schema';
