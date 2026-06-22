-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sequence for visit codes first
CREATE SEQUENCE IF NOT EXISTS visit_seq START 1;

-- Services table
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  manager_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles/Users extension
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reception' CHECK (role IN ('admin', 'director', 'reception', 'service_manager', 'accounting')),
  service_id UUID REFERENCES services(id),
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visitors table
CREATE TABLE visitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  visitor_type TEXT NOT NULL CHECK (visitor_type IN ('client', 'prospect', 'supplier', 'partner', 'other')),
  phone TEXT,
  email TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visits table
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id UUID NOT NULL REFERENCES visitors(id),
  visit_code TEXT UNIQUE NOT NULL DEFAULT 'VST-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('visit_seq')::TEXT, 5, '0'),
  arrival_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  departure_time TIMESTAMPTZ,
  purpose TEXT NOT NULL,
  has_appointment BOOLEAN DEFAULT false,
  person_to_meet TEXT,
  service_id UUID REFERENCES services(id),
  comments TEXT,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID NOT NULL REFERENCES visits(id),
  is_billable BOOLEAN DEFAULT false,
  amount DECIMAL(12, 2) DEFAULT 0,
  invoice_date DATE,
  payment_status TEXT DEFAULT 'not_invoiced' CHECK (payment_status IN ('not_invoiced', 'invoiced', 'paid', 'partially_paid', 'cancelled')),
  service_status TEXT DEFAULT 'pending' CHECK (service_status IN ('pending', 'in_progress', 'completed', 'blocked', 'late')),
  expected_duration_days INTEGER DEFAULT 7,
  deadline DATE,
  responsible_service_id UUID REFERENCES services(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visit follow-ups
CREATE TABLE visit_followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID NOT NULL REFERENCES visits(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'late')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments table
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID NOT NULL REFERENCES visits(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for services
CREATE POLICY "services_select" ON services FOR SELECT TO authenticated USING (true);
CREATE POLICY "services_insert" ON services FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')));
CREATE POLICY "services_update" ON services FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')));
CREATE POLICY "services_delete" ON services FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- RLS Policies for profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- RLS Policies for visitors
CREATE POLICY "visitors_select" ON visitors FOR SELECT TO authenticated USING (true);
CREATE POLICY "visitors_insert" ON visitors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "visitors_update" ON visitors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "visitors_delete" ON visitors FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')));

-- RLS Policies for visits
CREATE POLICY "visits_select" ON visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "visits_insert" ON visits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "visits_update" ON visits FOR UPDATE TO authenticated USING (true);
CREATE POLICY "visits_delete" ON visits FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')));

-- RLS Policies for invoices
CREATE POLICY "invoices_select" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_insert" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "invoices_update" ON invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "invoices_delete" ON invoices FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director', 'accounting')));

-- RLS Policies for visit_followups
CREATE POLICY "followups_select" ON visit_followups FOR SELECT TO authenticated USING (true);
CREATE POLICY "followups_insert" ON visit_followups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "followups_update" ON visit_followups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "followups_delete" ON visit_followups FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')));

-- RLS Policies for comments
CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- RLS Policies for activity_logs
CREATE POLICY "logs_select" ON activity_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')));
CREATE POLICY "logs_insert" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies for notifications
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_delete" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Functions and triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_visitors_updated_at BEFORE UPDATE ON visitors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_followups_updated_at BEFORE UPDATE ON visit_followups FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert default services with fixed UUIDs to match demo data references
INSERT INTO services (id, name, description) VALUES
('17f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Service informatique', 'Gestion des systèmes informatiques et support technique'),
('a37fb89b-7e61-4560-84fe-b9c1b4834ff8', 'Service IMO', 'Immobilier et operations immobilières'),
('32d81751-a260-485e-8b14-80362de13313', 'Service technique', 'Maintenance et operations techniques'),
('32a3c0c6-0b0f-4173-8e6f-4b1178c51270', 'Service suivi des ACD', 'Suivi et gestion des ACD'),
('89341b8b-2858-4f08-9f5c-02167908eab5', 'Direction Générale', 'Direction et stratégie de l''entreprise'),
('b5cf3c00-d8cb-402a-9f5e-141cd0c3eb1a', 'Administration', 'Services administratifs'),
('c7a72387-ec6b-4e1b-ad34-d02fe1dbd244', 'Comptabilité / Finance', 'Gestion financière et comptabilité'),
('d5d9c282-3d5f-4a0b-93df-8cd5e150ee18', 'Autres services', 'Services divers');
