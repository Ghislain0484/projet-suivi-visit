-- Allow service_manager to update invoices
DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
CREATE POLICY "invoices_update" ON public.invoices 
  FOR UPDATE TO authenticated 
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'accounting', 'cashier', 'service_manager'));

-- Allow service_manager to delete invoices
DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
CREATE POLICY "invoices_delete" ON public.invoices 
  FOR DELETE TO authenticated 
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'accounting', 'service_manager'));

-- Reload Postgrest schema
NOTIFY pgrst, 'reload schema';
