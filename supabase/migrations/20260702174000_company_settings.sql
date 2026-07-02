-- Create company_settings table
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR NOT NULL DEFAULT 'GICO SARL',
  slogan VARCHAR DEFAULT 'Gestion & Intégration de Services Collaboratifs',
  rccm VARCHAR DEFAULT 'BF-OUA-2026-B-1234',
  ifu VARCHAR DEFAULT '00123456X',
  phone VARCHAR DEFAULT '+226 25 30 00 00',
  email VARCHAR DEFAULT 'contact@gico.bf',
  website VARCHAR DEFAULT 'www.gico.bf',
  logo_url VARCHAR,
  currency VARCHAR DEFAULT 'XOF',
  visit_prefix VARCHAR DEFAULT 'VT',
  invoice_prefix VARCHAR DEFAULT 'FAC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- 1. Select policy: authenticated users can read company settings
DROP POLICY IF EXISTS "company_settings_select" ON public.company_settings;
CREATE POLICY "company_settings_select" ON public.company_settings
  FOR SELECT TO authenticated USING (true);

-- 2. Update policy: admin, director, and reception can update company settings
DROP POLICY IF EXISTS "company_settings_update" ON public.company_settings;
CREATE POLICY "company_settings_update" ON public.company_settings
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

-- Seed default company settings if empty
INSERT INTO public.company_settings (
  company_name, slogan, rccm, ifu, phone, email, website, logo_url, currency, visit_prefix, invoice_prefix
)
SELECT
  'GICO SARL',
  'Gestion & Intégration de Services Collaboratifs',
  'BF-OUA-2026-B-1234',
  '00123456X',
  '+226 25 30 00 00',
  'contact@gico.bf',
  'www.gico.bf',
  NULL,
  'XOF',
  'VT',
  'FAC'
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);

-- Reload schema
NOTIFY pgrst, 'reload schema';
