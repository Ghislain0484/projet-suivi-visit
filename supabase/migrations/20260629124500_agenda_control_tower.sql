-- 1. Update RLS policies for permissions table to include service_manager role
DROP POLICY IF EXISTS "permissions_select" ON public.permissions;
CREATE POLICY "permissions_select" ON public.permissions 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director', 'service_manager'));

DROP POLICY IF EXISTS "permissions_update" ON public.permissions;
CREATE POLICY "permissions_update" ON public.permissions 
  FOR UPDATE TO authenticated 
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'service_manager'));

-- 2. Modify invoice_items table to support custom/unregistered prestations
ALTER TABLE public.invoice_items ALTER COLUMN service_item_id DROP NOT NULL;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS custom_name TEXT;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
