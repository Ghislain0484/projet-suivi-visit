-- 1. Création de la fonction de lecture sécurisée du rôle (Security Definer)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = user_id),
    'collaborator'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Recréation de la politique de sélection des profils (toujours simple et permise)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);

-- 3. Mise à jour de la politique de mise à jour des profils
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (
  auth.uid() = id OR public.get_user_role(auth.uid()) = 'admin'
);

-- 4. Mise à jour des politiques RLS sur les autres tables
-- services
DROP POLICY IF EXISTS "services_insert" ON services;
CREATE POLICY "services_insert" ON services FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director'));

DROP POLICY IF EXISTS "services_update" ON services;
CREATE POLICY "services_update" ON services FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director'));

DROP POLICY IF EXISTS "services_delete" ON services;
CREATE POLICY "services_delete" ON services FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) = 'admin');

-- visitors
DROP POLICY IF EXISTS "visitors_delete" ON visitors;
CREATE POLICY "visitors_delete" ON visitors FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- visits
DROP POLICY IF EXISTS "visits_update" ON visits;
CREATE POLICY "visits_update" ON visits FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'service_manager', 'collaborator'));

DROP POLICY IF EXISTS "visits_delete" ON visits;
CREATE POLICY "visits_delete" ON visits FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- invoices
DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'accounting', 'cashier'));

DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'accounting'));

-- visit_followups
DROP POLICY IF EXISTS "followups_delete" ON visit_followups;
CREATE POLICY "followups_delete" ON visit_followups FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- comments
DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) = 'admin');

-- activity_logs
DROP POLICY IF EXISTS "logs_select" ON activity_logs;
CREATE POLICY "logs_select" ON activity_logs FOR SELECT TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- appointments
DROP POLICY IF EXISTS "appointments_update" ON appointments;
CREATE POLICY "appointments_update" ON appointments FOR UPDATE TO authenticated USING (auth.uid() = created_by OR auth.uid() = assigned_to OR public.get_user_role(auth.uid()) IN ('admin', 'reception', 'director'));

DROP POLICY IF EXISTS "appointments_delete" ON appointments;
CREATE POLICY "appointments_delete" ON appointments FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.get_user_role(auth.uid()) IN ('admin', 'reception', 'director'));

-- hr_presences
DROP POLICY IF EXISTS "presences_select" ON hr_presences;
CREATE POLICY "presences_select" ON hr_presences FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

DROP POLICY IF EXISTS "presences_update" ON hr_presences;
CREATE POLICY "presences_update" ON hr_presences FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- missions
DROP POLICY IF EXISTS "missions_select" ON missions;
CREATE POLICY "missions_select" ON missions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'service_manager'));

DROP POLICY IF EXISTS "missions_insert" ON missions;
CREATE POLICY "missions_insert" ON missions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

DROP POLICY IF EXISTS "missions_update" ON missions;
CREATE POLICY "missions_update" ON missions FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- permissions
DROP POLICY IF EXISTS "permissions_select" ON permissions;
CREATE POLICY "permissions_select" ON permissions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director'));

DROP POLICY IF EXISTS "permissions_update" ON permissions;
CREATE POLICY "permissions_update" ON permissions FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- medical_requests
DROP POLICY IF EXISTS "medical_select" ON medical_requests;
CREATE POLICY "medical_select" ON medical_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'nurse'));

DROP POLICY IF EXISTS "medical_update" ON medical_requests;
CREATE POLICY "medical_update" ON medical_requests FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'nurse'));

-- service_items
DROP POLICY IF EXISTS "service_items_insert" ON service_items;
CREATE POLICY "service_items_insert" ON service_items FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director'));

DROP POLICY IF EXISTS "service_items_update" ON service_items;
CREATE POLICY "service_items_update" ON service_items FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director'));

DROP POLICY IF EXISTS "service_items_delete" ON service_items;
CREATE POLICY "service_items_delete" ON service_items FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) = 'admin');

-- Recharger l'API PostgREST
NOTIFY pgrst, 'reload schema';
