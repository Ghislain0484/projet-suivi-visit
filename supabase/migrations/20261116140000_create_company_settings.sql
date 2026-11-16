-- =======================================================
-- MIGRATION: 20261116140000_create_company_settings.sql
-- Description: 
-- Création de la table company_settings avec support de l'adresse,
-- du logo local/base64 (TEXT), des paramètres de relance et RLS.
-- =======================================================

CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'GICO SARL',
  slogan TEXT DEFAULT 'CONSTRUIRE AVEC VOUS UN IDEAL',
  rccm TEXT DEFAULT '',
  ifu TEXT DEFAULT '',
  company_address TEXT DEFAULT 'Bonoua Yaou face Pharmacie de Bonoua',
  phone TEXT DEFAULT '+225 2721211149',
  email TEXT DEFAULT 'contact@gicosarl.net',
  website TEXT DEFAULT 'https://gicosarl.net/',
  logo_url TEXT,
  currency TEXT DEFAULT 'XOF',
  visit_prefix TEXT DEFAULT 'VT',
  invoice_prefix TEXT DEFAULT 'FAC',
  default_duration_days INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la table existait déjà avec un type limité ou sans colonnes requises
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS company_address TEXT DEFAULT 'Bonoua Yaou face Pharmacie de Bonoua';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS default_duration_days INTEGER DEFAULT 7;
ALTER TABLE public.company_settings ALTER COLUMN logo_url TYPE TEXT;

-- Activation de Row Level Security
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- 1. Lecture autorisée pour tous les utilisateurs authentifiés
DROP POLICY IF EXISTS "company_settings_select" ON public.company_settings;
CREATE POLICY "company_settings_select" ON public.company_settings
  FOR SELECT TO authenticated USING (true);

-- 2. Modification et Insertion réservées aux administrateurs, direction et réception/GRH
DROP POLICY IF EXISTS "company_settings_all" ON public.company_settings;
CREATE POLICY "company_settings_all" ON public.company_settings
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'grh'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'grh'));

-- Insérer la ligne initiale avec les coordonnées réelles de GICO SARL si elle n'existe pas
INSERT INTO public.company_settings (
  company_name, slogan, rccm, ifu, phone, email, website, company_address, logo_url, currency, visit_prefix, invoice_prefix, default_duration_days
)
SELECT
  'GICO SARL',
  'CONSTRUIRE AVEC VOUS UN IDEAL',
  '',
  '',
  '+225 2721211149',
  'contact@gicosarl.net',
  'https://gicosarl.net/',
  'Bonoua Yaou face Pharmacie de Bonoua',
  'https://gicosarl.net/pages/images/logo-gico.png',
  'XOF',
  'VT',
  'FAC',
  7
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);

-- Notifier PostgREST pour recharger le cache du schéma
NOTIFY pgrst, 'reload schema';
