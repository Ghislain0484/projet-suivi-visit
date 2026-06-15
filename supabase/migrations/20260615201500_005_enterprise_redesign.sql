-- 1. Mise à jour des rôles autorisés dans les profils
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'director', 'reception', 'service_manager', 'accounting', 'cashier', 'collaborator', 'nurse'));

-- 2. Mise à jour de la table visits pour le suivi collaboratif
ALTER TABLE visits ADD COLUMN IF NOT EXISTS assigned_collaborator_id UUID;
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_assigned_collaborator_id_fkey;
ALTER TABLE visits ADD CONSTRAINT visits_assigned_collaborator_id_fkey FOREIGN KEY (assigned_collaborator_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS observations TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS report TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS attachments TEXT[];

-- Retrait de la contrainte stricte précédente sur le statut de visite
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE visits ADD CONSTRAINT visits_status_check CHECK (status IN ('in_progress', 'completed', 'cancelled', 'traite', 'en_cours', 'a_relancer', 'transforme', 'annule'));

-- 3. Mise à jour de la table notifications ( WhatsApp-like )
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS response_status TEXT CHECK (response_status IN ('pending', 'accepted', 'busy', 'refused')) DEFAULT 'pending';

-- 4. Création de la table appointments (Agenda)
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  assigned_to UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activation RLS et Politiques pour appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_select" ON appointments;
DROP POLICY IF EXISTS "appointments_insert" ON appointments;
DROP POLICY IF EXISTS "appointments_update" ON appointments;
DROP POLICY IF EXISTS "appointments_delete" ON appointments;

CREATE POLICY "appointments_select" ON appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "appointments_insert" ON appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "appointments_update" ON appointments FOR UPDATE TO authenticated USING (
  auth.uid() = created_by OR auth.uid() = assigned_to OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'reception', 'director'))
);
CREATE POLICY "appointments_delete" ON appointments FOR DELETE TO authenticated USING (
  auth.uid() = created_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'reception', 'director'))
);

-- 5. Création de la table hr_presences (Pointage)
CREATE TABLE IF NOT EXISTS hr_presences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  arrival_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  qr_code_token TEXT,
  gps_location TEXT,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'pause', 'mission', 'displacement', 'absent', 'leave', 'permission')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- Activation RLS et Politiques pour hr_presences
ALTER TABLE hr_presences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presences_select" ON hr_presences;
DROP POLICY IF EXISTS "presences_insert" ON hr_presences;
DROP POLICY IF EXISTS "presences_update" ON hr_presences;

CREATE POLICY "presences_select" ON hr_presences FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'reception'))
);
CREATE POLICY "presences_insert" ON hr_presences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presences_update" ON hr_presences FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director'))
);

-- 6. Création de la table missions (Missions RH)
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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

-- Activation RLS et Politiques pour missions
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "missions_select" ON missions;
DROP POLICY IF EXISTS "missions_insert" ON missions;
DROP POLICY IF EXISTS "missions_update" ON missions;

CREATE POLICY "missions_select" ON missions FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'reception', 'service_manager'))
);
CREATE POLICY "missions_insert" ON missions FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'reception'))
);
CREATE POLICY "missions_update" ON missions FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director'))
);

-- 7. Création de la table permissions (Demandes d'absences/congés)
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('permission', 'absence', 'leave')),
  reason TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activation RLS et Politiques pour permissions
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissions_select" ON permissions;
DROP POLICY IF EXISTS "permissions_insert" ON permissions;
DROP POLICY IF EXISTS "permissions_update" ON permissions;

CREATE POLICY "permissions_select" ON permissions FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director'))
);
CREATE POLICY "permissions_insert" ON permissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "permissions_update" ON permissions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director'))
);

-- 8. Création de la table medical_requests (Infirmerie)
CREATE TABLE IF NOT EXISTS medical_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('consultation', 'sickness', 'rest')),
  symptoms TEXT NOT NULL,
  nurse_opinion TEXT,
  prescription TEXT,
  rest_days_granted INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'rejected')),
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activation RLS et Politiques pour medical_requests
ALTER TABLE medical_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medical_select" ON medical_requests;
DROP POLICY IF EXISTS "medical_insert" ON medical_requests;
DROP POLICY IF EXISTS "medical_update" ON medical_requests;

CREATE POLICY "medical_select" ON medical_requests FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'nurse'))
);
CREATE POLICY "medical_insert" ON medical_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "medical_update" ON medical_requests FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'nurse'))
);

-- 9. Déclencheurs pour le champ updated_at sur les nouvelles tables
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

-- 10. Renforcement de la sécurité RLS sur les tables existantes (Option A)
DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'accounting', 'cashier'))
);

DROP POLICY IF EXISTS "visits_update" ON visits;
CREATE POLICY "visits_update" ON visits FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'reception', 'service_manager', 'collaborator'))
);

-- Rechargement obligatoire du cache PostgREST API
NOTIFY pgrst, 'reload schema';
