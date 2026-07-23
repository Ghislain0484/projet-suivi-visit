-- Allow reception role in services RLS
DROP POLICY IF EXISTS "services_insert" ON public.services;
CREATE POLICY "services_insert" ON public.services FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

DROP POLICY IF EXISTS "services_update" ON public.services;
CREATE POLICY "services_update" ON public.services FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

-- Allow reception role in service_items RLS
DROP POLICY IF EXISTS "service_items_insert" ON public.service_items;
CREATE POLICY "service_items_insert" ON public.service_items FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

DROP POLICY IF EXISTS "service_items_update" ON public.service_items;
CREATE POLICY "service_items_update" ON public.service_items FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

-- Allow reception role in service_items RLS (delete)
DROP POLICY IF EXISTS "service_items_delete" ON public.service_items;
CREATE POLICY "service_items_delete" ON public.service_items FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

-- Allow reception role in visitors/visits/followups delete RLS
DROP POLICY IF EXISTS "visitors_delete" ON public.visitors;
CREATE POLICY "visitors_delete" ON public.visitors FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

DROP POLICY IF EXISTS "visits_delete" ON public.visits;
CREATE POLICY "visits_delete" ON public.visits FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

DROP POLICY IF EXISTS "followups_delete" ON public.visit_followups;
CREATE POLICY "followups_delete" ON public.visit_followups FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

-- Allow reception role in visit_access RLS
DROP POLICY IF EXISTS "visit_access_insert" ON public.visit_access;
CREATE POLICY "visit_access_insert" ON public.visit_access FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

DROP POLICY IF EXISTS "visit_access_delete" ON public.visit_access;
CREATE POLICY "visit_access_delete" ON public.visit_access FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

-- Allow reception role in notification automation configurations RLS
DROP POLICY IF EXISTS "automation_settings_all" ON public.automation_settings;
CREATE POLICY "automation_settings_all" ON public.automation_settings FOR ALL TO authenticated 
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

DROP POLICY IF EXISTS "notification_recipients_all" ON public.notification_recipients;
CREATE POLICY "notification_recipients_all" ON public.notification_recipients FOR ALL TO authenticated 
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

DROP POLICY IF EXISTS "notification_logs_all" ON public.notification_logs;
CREATE POLICY "notification_logs_all" ON public.notification_logs FOR ALL TO authenticated 
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

-- Reload Postgrest schema
NOTIFY pgrst, 'reload schema';
