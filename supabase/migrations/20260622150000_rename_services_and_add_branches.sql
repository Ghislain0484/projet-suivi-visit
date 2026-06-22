-- =======================================================
-- MIGRATION: 20260622150000_rename_services_and_add_branches.sql
-- Description: Restructuration des services (SPAS, SIM, SBAT, STOP, SCOFI), assignation de l'Administration au DG, et ajout des succursales.
-- =======================================================

-- 1. Renommer et mettre à jour les services existants
UPDATE public.services 
SET name = 'Service du Patrimoine et des Actions Stratégiques (SPAS)', 
    description = 'Gestion et suivi du patrimoine immobilier/foncier et actions stratégiques de l''entreprise'
WHERE id = '32a3c0c6-0b0f-4173-8e6f-4b1178c51270';

UPDATE public.services 
SET name = 'Service IMMO (SIM)', 
    description = 'Gestion immobilière, de patrimoine et syndic de copropriété'
WHERE id = 'a37fb89b-7e61-4560-84fe-b9c1b4834ff8';

UPDATE public.services 
SET name = 'Service Bat (SBAT)', 
    description = 'Génie civil, plans 2D/3D et construction de bâtiments'
WHERE id = '32d81751-a260-485e-8b14-80362de13313';

UPDATE public.services 
SET name = 'Service Comptabilité et Finance (SCOFI)', 
    description = 'Gestion financière, comptable et trésorerie'
WHERE id = 'c7a72387-ec6b-4e1b-ad34-d02fe1dbd244';

-- 2. Création de la deuxième branche du service technique : Service Topo (STOP)
INSERT INTO public.services (id, name, description, is_active) VALUES
('57f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Service Topo (STOP)', 'Travaux topographiques, bornages de terrains et lotissements', true)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 3. Assigner le Directeur Général comme responsable du service Administration
UPDATE public.services 
SET manager_id = (SELECT id FROM public.profiles WHERE role = 'director' LIMIT 1)
WHERE id = 'b5cf3c00-d8cb-402a-9f5e-141cd0c3eb1a';

-- 4. Ajouter les démembrements / succursales en dehors du siège aux profils et visites
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT 'Siège (Bonoua)';
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT 'Siège (Bonoua)';

-- 5. Remplir le catalogue de prestations pour le nouveau Service Topo (STOP)
DELETE FROM public.service_items WHERE service_id = '57f2b27c-350a-41bc-bffe-99fdda2aab8b';
INSERT INTO public.service_items (service_id, name, price) VALUES
('57f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Levée topographique de terrain (par lot)', 200000),
('57f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Implantation de bornes et délimitation', 150000),
('57f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Plan topographique de lotissement', 500000),
('57f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Rattachement géodésique', 180000);

-- Recharger PostgREST
NOTIFY pgrst, 'reload schema';
