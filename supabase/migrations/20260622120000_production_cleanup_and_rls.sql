-- =======================================================
-- MIGRATION: 20260622120000_production_cleanup_and_rls.sql
-- Description: Suppression des données mock de test et correction RLS notifications.
-- =======================================================

-- 1. Nettoyage sélectif des données de démonstration/test (UUIDs en séries fixes)
-- Suppression dans le bon ordre pour respecter les clés étrangères
DELETE FROM public.comments WHERE visit_id::text LIKE '22222222-%';
DELETE FROM public.visit_followups WHERE id::text LIKE '44444444-%' OR visit_id::text LIKE '22222222-%';
DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM public.invoices WHERE visit_id::text LIKE '22222222-%');
DELETE FROM public.invoices WHERE id::text LIKE '33333333-%' OR visit_id::text LIKE '22222222-%';
DELETE FROM public.appointments WHERE visit_id::text LIKE '22222222-%';
DELETE FROM public.visits WHERE id::text LIKE '22222222-%';
DELETE FROM public.visitors WHERE id::text LIKE '11111111-%';

-- 2. Ajout de la politique d'insertion manquante pour les notifications
-- Nécessaire pour que les réceptions/utilisateurs puissent envoyer des notifications à d'autres collaborateurs
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- 3. Mise à jour de la politique RLS profiles pour autoriser le Directeur Général à gérer les profils sans modifier les admins
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles 
FOR UPDATE TO authenticated 
USING (
  auth.uid() = id 
  OR public.get_user_role(auth.uid()) = 'admin'
  OR (public.get_user_role(auth.uid()) = 'director' AND role <> 'admin')
)
WITH CHECK (
  (auth.uid() = id AND role = public.get_user_role(auth.uid()))
  OR public.get_user_role(auth.uid()) = 'admin'
  OR (public.get_user_role(auth.uid()) = 'director' AND role <> 'admin')
);

