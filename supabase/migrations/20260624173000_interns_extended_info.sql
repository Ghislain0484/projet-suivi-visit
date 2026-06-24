-- =======================================================
-- MIGRATION: 20260624173000_interns_extended_info.sql
-- Description: Extension de la table interns pour suivre le département, la date de début, de fin, le téléphone, l'établissement scolaire et des remarques.
-- =======================================================

ALTER TABLE public.interns 
ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS school_or_institution TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Recharger PostgREST pour propager les modifications de schéma
NOTIFY pgrst, 'reload schema';
