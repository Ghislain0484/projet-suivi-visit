-- =======================================================
-- MIGRATION: 20260622140000_service_catalogs_and_deletes.sql
-- Description: Cascade deletes, updated delete RLS policies for admin/director, and real GICO SARL catalogs.
-- =======================================================

-- 1. Configuration des suppressions en cascade (Cascade Deletes)
-- Permet de supprimer une visite et de supprimer automatiquement les factures, suivis et commentaires associés sans erreur de clé étrangère.

ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_visit_id_fkey;
ALTER TABLE public.comments ADD CONSTRAINT comments_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE CASCADE;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_visit_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE CASCADE;

ALTER TABLE public.visit_followups DROP CONSTRAINT IF EXISTS visit_followups_visit_id_fkey;
ALTER TABLE public.visit_followups ADD CONSTRAINT visit_followups_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE CASCADE;


-- 2. Mise à jour des politiques RLS de suppression pour autoriser l'administrateur et le directeur
-- Autoriser la suppression des services par admin et director
DROP POLICY IF EXISTS "services_delete" ON public.services;
CREATE POLICY "services_delete" ON public.services FOR DELETE TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- Autoriser la suppression des prestations du catalogue (service_items) par admin et director
DROP POLICY IF EXISTS "service_items_delete" ON public.service_items;
CREATE POLICY "service_items_delete" ON public.service_items FOR DELETE TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- Autoriser la suppression des commentaires par l'auteur, l'admin et le directeur
DROP POLICY IF EXISTS "comments_delete" ON public.comments;
CREATE POLICY "comments_delete" ON public.comments FOR DELETE TO authenticated 
USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director'));


-- 3. Remplissage des catalogues de prestations de GICO SARL (Foncier, Immobilier, Génie Civil)
-- Nettoyage des anciennes prestations de démonstration
DELETE FROM public.service_items WHERE service_id IN (
  'a37fb89b-7e61-4560-84fe-b9c1b4834ff8', -- Service IMO
  '32a3c0c6-0b0f-4173-8e6f-4b1178c51270', -- Service suivi des ACD
  '32d81751-a260-485e-8b14-80362de13313', -- Service technique
  'c7a72387-ec6b-4e1b-ad34-d02fe1dbd244', -- Comptabilité / Finance
  'b5cf3c00-d8cb-402a-9f5e-141cd0c3eb1a'  -- Administration
);

-- Insertion des nouvelles prestations réelles
-- Service IMO (Immobilier, gestion, syndic)
INSERT INTO public.service_items (service_id, name, price) VALUES
('a37fb89b-7e61-4560-84fe-b9c1b4834ff8', 'Gestion locative mensuelle (Base)', 15000),
('a37fb89b-7e61-4560-84fe-b9c1b4834ff8', 'Rédaction de contrat de bail résidentiel', 50000),
('a37fb89b-7e61-4560-84fe-b9c1b4834ff8', 'Visite guidée et état des lieux', 10000),
('a37fb89b-7e61-4560-84fe-b9c1b4834ff8', 'Honoraires syndic de copropriété (Mensuel)', 25000),
('a37fb89b-7e61-4560-84fe-b9c1b4834ff8', 'Évaluation de valeur vénale de bien', 120000);

-- Service suivi des ACD (Foncier et lotissement)
INSERT INTO public.service_items (service_id, name, price) VALUES
('32a3c0c6-0b0f-4173-8e6f-4b1178c51270', 'Constitution de dossier technique de bornage', 250000),
('32a3c0c6-0b0f-4173-8e6f-4b1178c51270', 'Enquête foncière et vérification cadastrale', 75000),
('32a3c0c6-0b0f-4173-8e6f-4b1178c51270', 'Dépôt et suivi de dossier d''ACD', 150000),
('32a3c0c6-0b0f-4173-8e6f-4b1178c51270', 'Levée topographique de terrain (par lot)', 200000),
('32a3c0c6-0b0f-4173-8e6f-4b1178c51270', 'Dossier d''approbation de lotissement', 600000);

-- Service technique (Génie Civil, construction, plans)
INSERT INTO public.service_items (service_id, name, price) VALUES
('32d81751-a260-485e-8b14-80362de13313', 'Conception de plan architectural 2D/3D', 350000),
('32d81751-a260-485e-8b14-80362de13313', 'Devis estimatif et quantitatif de travaux', 60000),
('32d81751-a260-485e-8b14-80362de13313', 'Suivi de chantier et contrôle technique (Mensuel)', 150000),
('32d81751-a260-485e-8b14-80362de13313', 'Expertise et audit technique de bâtiment', 250000);

-- Comptabilité / Finance
INSERT INTO public.service_items (service_id, name, price) VALUES
('c7a72387-ec6b-4e1b-ad34-d02fe1dbd244', 'Analyse de rentabilité de projet immobilier', 150000),
('c7a72387-ec6b-4e1b-ad34-d02fe1dbd244', 'Consultation comptable et fiscale', 50000);

-- Administration
INSERT INTO public.service_items (service_id, name, price) VALUES
('b5cf3c00-d8cb-402a-9f5e-141cd0c3eb1a', 'Traitement et certification de document', 5000),
('b5cf3c00-d8cb-402a-9f5e-141cd0c3eb1a', 'Rédaction d''acte sous seing privé', 45000);

-- Recharger PostgREST
NOTIFY pgrst, 'reload schema';
