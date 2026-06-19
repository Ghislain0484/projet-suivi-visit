-- ==========================================
-- MIGRATION : 20260619224500_medical_and_hr_presences.sql
-- Description: Création des tables administratives, de pointage RH, et du module Infirmerie amélioré.
-- ==========================================

-- Activer l'extension uuid-ossp si non existante
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Mise à jour de la contrainte des rôles autorisés dans les profils pour inclure 'nurse' et 'cashier'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'director', 'reception', 'service_manager', 'accounting', 'cashier', 'collaborator', 'nurse'));

-- 2. Création de la table appointments (Agenda général) si absente
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  visitor_id UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  assigned_to UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Création de la table missions (Missions RH) si absente
CREATE TABLE IF NOT EXISTS public.missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  purpose TEXT NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_return TIMESTAMPTZ NOT NULL,
  actual_return TIMESTAMPTZ,
  gps_coordinates TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Création de la table permissions (Demandes d'absences/congés) si absente
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('permission', 'absence', 'leave')),
  reason TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  validated_by UUID REFERENCES public.profiles(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Création de la table medical_requests (Symptômes & Soins de base) si absente
CREATE TABLE IF NOT EXISTS public.medical_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('consultation', 'sickness', 'rest')),
  symptoms TEXT NOT NULL,
  attachments TEXT[], -- Ordonnances, documents joints en PDF/JPG/PNG
  nurse_opinion TEXT,
  prescription TEXT,
  rest_days_granted INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'rejected')),
  processed_by UUID REFERENCES public.profiles(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assurer que la colonne attachments existe si la table a été créée précédemment
ALTER TABLE public.medical_requests ADD COLUMN IF NOT EXISTS attachments TEXT[];


-- 6. Création de la table hr_presences (Pointage) si absente, ou mise à jour avec géolocalisation
CREATE TABLE IF NOT EXISTS public.hr_presences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_name TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  arrival_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'pause', 'mission', 'displacement', 'absent', 'leave', 'permission', 'departed')),
  qr_code_token TEXT,
  gps_location TEXT,
  check_in_latitude NUMERIC,
  check_in_longitude NUMERIC,
  check_out_latitude NUMERIC,
  check_out_longitude NUMERIC,
  location_accuracy NUMERIC,
  device_info TEXT,
  qr_code_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- Assurer que les colonnes nécessaires existent si la table a été créée précédemment
ALTER TABLE public.hr_presences ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE public.hr_presences ADD COLUMN IF NOT EXISTS check_in_latitude NUMERIC;
ALTER TABLE public.hr_presences ADD COLUMN IF NOT EXISTS check_in_longitude NUMERIC;
ALTER TABLE public.hr_presences ADD COLUMN IF NOT EXISTS check_out_latitude NUMERIC;
ALTER TABLE public.hr_presences ADD COLUMN IF NOT EXISTS check_out_longitude NUMERIC;
ALTER TABLE public.hr_presences ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC;
ALTER TABLE public.hr_presences ADD COLUMN IF NOT EXISTS device_info TEXT;
ALTER TABLE public.hr_presences ADD COLUMN IF NOT EXISTS qr_code_version TEXT;

-- Mettre à jour la contrainte de statut pour autoriser 'departed' si la table existait
ALTER TABLE public.hr_presences DROP CONSTRAINT IF EXISTS hr_presences_status_check;
ALTER TABLE public.hr_presences ADD CONSTRAINT hr_presences_status_check CHECK (status IN ('present', 'pause', 'mission', 'displacement', 'absent', 'leave', 'permission', 'departed'));


-- 7. Création de la table medical_files (Dossiers Médicaux Numériques)
CREATE TABLE IF NOT EXISTS public.medical_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  matricule TEXT UNIQUE,
  gender TEXT CHECK (gender IN ('M', 'F')),
  birth_date DATE,
  blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  department TEXT,
  position TEXT,
  allergies TEXT,
  vaccinations TEXT,
  current_treatments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Création de la table pharmacy_products (Gestion Stock Pharmacie)
CREATE TABLE IF NOT EXISTS public.pharmacy_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  reference TEXT UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('antalgiques', 'antibiotiques', 'antiseptiques', 'pansements', 'premiers_secours', 'consommables', 'autre')),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_threshold INTEGER NOT NULL DEFAULT 5 CHECK (min_threshold >= 0),
  expiration_date DATE,
  supplier TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Création de la table pharmacy_movements (Mouvements de stock)
CREATE TABLE IF NOT EXISTS public.pharmacy_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.pharmacy_products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'consumption', 'adjustment')),
  quantity INTEGER NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Création de la table medical_appointments (Agenda de l'infirmerie)
CREATE TABLE IF NOT EXISTS public.medical_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('consultation', 'urgence', 'periodique', 'reprise')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'realized', 'postponed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Création de la table medical_exams (Carnet d'examens périodiques)
CREATE TABLE IF NOT EXISTS public.medical_exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('annual', 'hiring', 'return', 'special')),
  result TEXT NOT NULL,
  observations TEXT,
  recommendations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Cré de la table medical_rests (Fiches de repos médical)
CREATE TABLE IF NOT EXISTS public.medical_rests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.medical_requests(id) ON DELETE SET NULL,
  slip_number TEXT UNIQUE,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  motif TEXT NOT NULL,
  nurse_validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rh_validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Automatisation du champ updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attacher les triggers
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_presences_updated_at ON hr_presences;
CREATE TRIGGER update_presences_updated_at BEFORE UPDATE ON hr_presences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_missions_updated_at ON missions;
CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON missions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_permissions_updated_at ON permissions;
CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_medical_updated_at ON medical_requests;
CREATE TRIGGER update_medical_updated_at BEFORE UPDATE ON medical_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_medical_files_updated_at ON medical_files;
CREATE TRIGGER update_medical_files_updated_at BEFORE UPDATE ON medical_files FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_pharmacy_products_updated_at ON pharmacy_products;
CREATE TRIGGER update_pharmacy_products_updated_at BEFORE UPDATE ON pharmacy_products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_medical_appointments_updated_at ON medical_appointments;
CREATE TRIGGER update_medical_appointments_updated_at BEFORE UPDATE ON medical_appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_medical_exams_updated_at ON medical_exams;
CREATE TRIGGER update_medical_exams_updated_at BEFORE UPDATE ON medical_exams FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_medical_rests_updated_at ON medical_rests;
CREATE TRIGGER update_medical_rests_updated_at BEFORE UPDATE ON medical_rests FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ==========================================
-- ACTIVATION DE RLS SUR TOUTES LES TABLES
-- ==========================================
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_rests ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- POLITIQUES DE SECURITE RLS (Anti-récursion)
-- ==========================================

-- A. get_user_role function (Security Definer) pour contourner la récursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = user_id),
    'collaborator'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- B. appointments
DROP POLICY IF EXISTS "appointments_select" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert" ON public.appointments;
DROP POLICY IF EXISTS "appointments_update" ON public.appointments;
DROP POLICY IF EXISTS "appointments_delete" ON public.appointments;
CREATE POLICY "appointments_select" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "appointments_insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = created_by OR auth.uid() = assigned_to OR public.get_user_role(auth.uid()) IN ('admin', 'reception', 'director'));
CREATE POLICY "appointments_delete" ON public.appointments FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.get_user_role(auth.uid()) IN ('admin', 'reception', 'director'));

-- C. missions
DROP POLICY IF EXISTS "missions_select" ON public.missions;
DROP POLICY IF EXISTS "missions_insert" ON public.missions;
DROP POLICY IF EXISTS "missions_update" ON public.missions;
CREATE POLICY "missions_select" ON public.missions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'service_manager'));
CREATE POLICY "missions_insert" ON public.missions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));
CREATE POLICY "missions_update" ON public.missions FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- D. permissions
DROP POLICY IF EXISTS "permissions_select" ON public.permissions;
DROP POLICY IF EXISTS "permissions_insert" ON public.permissions;
DROP POLICY IF EXISTS "permissions_update" ON public.permissions;
CREATE POLICY "permissions_select" ON public.permissions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director'));
CREATE POLICY "permissions_insert" ON public.permissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "permissions_update" ON public.permissions FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- E. hr_presences
DROP POLICY IF EXISTS "presences_select" ON public.hr_presences;
DROP POLICY IF EXISTS "presences_insert" ON public.hr_presences;
DROP POLICY IF EXISTS "presences_update" ON public.hr_presences;
CREATE POLICY "presences_select" ON public.hr_presences FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));
CREATE POLICY "presences_insert" ON public.hr_presences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presences_update" ON public.hr_presences FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- F. medical_files (Dossiers Médicaux : Infirmier/Admin complet, Collaborateur personnel uniquement, RH bloqué)
DROP POLICY IF EXISTS "files_select" ON public.medical_files;
DROP POLICY IF EXISTS "files_insert" ON public.medical_files;
DROP POLICY IF EXISTS "files_update" ON public.medical_files;
CREATE POLICY "files_select" ON public.medical_files FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('nurse', 'admin'));
CREATE POLICY "files_insert" ON public.medical_files FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) IN ('nurse', 'admin'));
CREATE POLICY "files_update" ON public.medical_files FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) IN ('nurse', 'admin'));

-- G. medical_requests (Symptômes/Consultations : Infirmier/Admin complet, Collaborateur personnel, RH bloqué)
DROP POLICY IF EXISTS "medical_select" ON public.medical_requests;
DROP POLICY IF EXISTS "medical_insert" ON public.medical_requests;
DROP POLICY IF EXISTS "medical_update" ON public.medical_requests;
CREATE POLICY "medical_select" ON public.medical_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('nurse', 'admin'));
CREATE POLICY "medical_insert" ON public.medical_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('nurse', 'admin'));
CREATE POLICY "medical_update" ON public.medical_requests FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) IN ('nurse', 'admin'));

-- H. pharmacy_products (Pharmacie : Tous les connectés peuvent voir les stocks, Infirmier/Admin gère)
DROP POLICY IF EXISTS "pharmacy_select" ON public.pharmacy_products;
DROP POLICY IF EXISTS "pharmacy_all" ON public.pharmacy_products;
CREATE POLICY "pharmacy_select" ON public.pharmacy_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "pharmacy_all" ON public.pharmacy_products FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) IN ('nurse', 'admin'));

-- I. pharmacy_movements (Mouvements de stock : Tous peuvent voir, Infirmier/Admin écrit)
DROP POLICY IF EXISTS "movements_select" ON public.pharmacy_movements;
DROP POLICY IF EXISTS "movements_insert" ON public.pharmacy_movements;
CREATE POLICY "movements_select" ON public.pharmacy_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "movements_insert" ON public.pharmacy_movements FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) IN ('nurse', 'admin'));

-- J. medical_appointments (Rendez-vous médicaux : Infirmier/Admin complet, Collaborateur personnel, RH bloqué)
DROP POLICY IF EXISTS "med_appt_select" ON public.medical_appointments;
DROP POLICY IF EXISTS "med_appt_all" ON public.medical_appointments;
CREATE POLICY "med_appt_select" ON public.medical_appointments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('nurse', 'admin'));
CREATE POLICY "med_appt_all" ON public.medical_appointments FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) IN ('nurse', 'admin'));

-- K. medical_exams (Examens : Infirmier/Admin complet, Collaborateur personnel, RH bloqué)
DROP POLICY IF EXISTS "exams_select" ON public.medical_exams;
DROP POLICY IF EXISTS "exams_all" ON public.medical_exams;
CREATE POLICY "exams_select" ON public.medical_exams FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) IN ('nurse', 'admin'));
CREATE POLICY "exams_all" ON public.medical_exams FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) IN ('nurse', 'admin'));

-- L. medical_rests (Fiches de repos : Infirmier/Admin et RH complets pour validation administrative, Collaborateur personnel)
DROP POLICY IF EXISTS "rests_select" ON public.medical_rests;
DROP POLICY IF EXISTS "rests_all" ON public.medical_rests;
CREATE POLICY "rests_select" ON public.medical_rests FOR SELECT TO authenticated USING (auth.uid() = employee_id OR public.get_user_role(auth.uid()) IN ('nurse', 'admin', 'director'));
CREATE POLICY "rests_all" ON public.medical_rests FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) IN ('nurse', 'admin', 'director'));

-- Rechargement obligatoire de PostgREST
NOTIFY pgrst, 'reload schema';
