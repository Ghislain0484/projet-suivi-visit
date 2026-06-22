-- =======================================================
-- MIGRATION: 20260622160000_lawyer_role_and_attachments.sql
-- Description: Ajout du rôle juriste (lawyer), gestion des accès restreints aux visites, et configuration du stockage des documents joints.
-- =======================================================

-- 1. Ajouter le rôle 'lawyer' dans la liste des rôles autorisés
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'director', 'reception', 'service_manager', 'accounting', 'cashier', 'collaborator', 'nurse', 'lawyer'));

-- 2. Ajouter la visibilité générale des pièces jointes à la table des visites
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS attachments_visible_to_all BOOLEAN NOT NULL DEFAULT false;

-- 3. Créer la table visit_access pour accorder des droits aux dossiers spécifiques (ex: juriste)
CREATE TABLE IF NOT EXISTS public.visit_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_visit_user_access UNIQUE (visit_id, user_id)
);

-- RLS pour visit_access
ALTER TABLE public.visit_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visit_access_select" ON public.visit_access;
CREATE POLICY "visit_access_select" ON public.visit_access FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "visit_access_insert" ON public.visit_access;
CREATE POLICY "visit_access_insert" ON public.visit_access FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director'));

DROP POLICY IF EXISTS "visit_access_delete" ON public.visit_access;
CREATE POLICY "visit_access_delete" ON public.visit_access FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director'));


-- 4. Mettre à jour les politiques d'accès SELECT sur visits et visitors
-- Restreindre les juristes aux dossiers qui leur sont explicitement délégués
DROP POLICY IF EXISTS "visits_select" ON public.visits;
CREATE POLICY "visits_select" ON public.visits FOR SELECT TO authenticated 
USING (
  public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'service_manager', 'accounting', 'cashier', 'nurse')
  OR auth.uid() = visits.assigned_collaborator_id 
  OR auth.uid() = visits.created_by
  OR EXISTS (
    SELECT 1 
    FROM public.visit_access va_select 
    WHERE va_select.visit_id = visits.id 
      AND va_select.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "visitors_select" ON public.visitors;
CREATE POLICY "visitors_select" ON public.visitors FOR SELECT TO authenticated 
USING (
  public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'service_manager', 'accounting', 'cashier', 'nurse')
  OR EXISTS (
    SELECT 1 
    FROM public.visits v_select
    WHERE v_select.visitor_id = visitors.id
      AND (
        v_select.created_by = auth.uid() 
        OR v_select.assigned_collaborator_id = auth.uid() 
        OR EXISTS (
          SELECT 1 
          FROM public.visit_access va_select 
          WHERE va_select.visit_id = v_select.id 
            AND va_select.user_id = auth.uid()
        )
      )
  )
);


-- 5. Créer et configurer le bucket de stockage de documents (attachments)
INSERT INTO storage.buckets (id, name, public)
SELECT 'attachments', 'attachments', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets b WHERE b.id = 'attachments'
);

DROP POLICY IF EXISTS "Allow public read of attachments" ON storage.objects;
CREATE POLICY "Allow public read of attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Allow upload of attachments" ON storage.objects;
CREATE POLICY "Allow upload of attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Allow delete of attachments" ON storage.objects;
CREATE POLICY "Allow delete of attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'attachments');

-- 6. Ajouter le service Ferme Bio (Fermo-Bio) et ses prestations
INSERT INTO public.services (id, name, description, is_active) VALUES
('f37fb89b-7e61-4560-84fe-b9c1b4834ff8', 'Ferme Bio (Fermo-Bio)', 'Élevage et vente de poulets frais fermiers et œufs 100% naturels', true)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description;

DELETE FROM public.service_items WHERE service_id = 'f37fb89b-7e61-4560-84fe-b9c1b4834ff8';
INSERT INTO public.service_items (service_id, name, price) VALUES
('f37fb89b-7e61-4560-84fe-b9c1b4834ff8', 'Poulet frais fermier (l''unité)', 4500),
('f37fb89b-7e61-4560-84fe-b9c1b4834ff8', 'Plateau d''œufs frais de ferme (30 œufs)', 3000),
('f37fb89b-7e61-4560-84fe-b9c1b4834ff8', 'Livraison rapide à domicile', 1500);

-- Recharger PostgREST
NOTIFY pgrst, 'reload schema';



