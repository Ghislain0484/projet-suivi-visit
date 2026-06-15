-- Drop existing constraint to update roles list
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'director', 'reception', 'service_manager', 'accounting', 'cashier'));

-- Add amount_paid to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- Create service_items (catalog of priced services)
CREATE TABLE IF NOT EXISTS service_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for service_items
ALTER TABLE service_items ENABLE ROW LEVEL SECURITY;

-- Policies for service_items
CREATE POLICY "service_items_select" ON service_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_items_insert" ON service_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director')));
CREATE POLICY "service_items_update" ON service_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director')));
CREATE POLICY "service_items_delete" ON service_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Create invoice_items (joining table for cart elements)
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_item_id UUID NOT NULL REFERENCES service_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_price DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for invoice_items
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Policies for invoice_items
CREATE POLICY "invoice_items_select" ON invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_items_insert" ON invoice_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "invoice_items_update" ON invoice_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "invoice_items_delete" ON invoice_items FOR DELETE TO authenticated USING (true);

-- Apply updated_at triggers
CREATE TRIGGER update_service_items_updated_at BEFORE UPDATE ON service_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_invoice_items_updated_at BEFORE UPDATE ON invoice_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert demo service items / tariffs
INSERT INTO service_items (service_id, name, price) VALUES
-- Service informatique (17f2b27c-350a-41bc-bffe-99fdda2aab8b)
('17f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Support technique PC / Laptop', 15000),
('17f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Installation & Config Système / OS', 25000),
('17f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Configuration d''accès réseau / VPN', 10000),

-- Service IMO (a37fb89b-7e61-4560-84fe-b9c1b4834ff8)
('a37fb89b-7e61-4560-84fe-b9c1b4834ff8', 'Frais d''étude dossier immobilier', 75000),
('a37fb89b-7e61-4560-84fe-b9c1b4834ff8', 'Visite de terrain / État des lieux', 50000),

-- Service technique (32d81751-a260-485e-8b14-80362de13313)
('32d81751-a260-485e-8b14-80362de13313', 'Maintenance équipement standard', 30000),
('32d81751-a260-485e-8b14-80362de13313', 'Dépannage électrique / Climatisation', 20000),

-- Service suivi des ACD (32a3c0c6-0b0f-4173-8e6f-4b1178c51270)
('32a3c0c6-0b0f-4173-8e6f-4b1178c51270', 'Frais administratifs de dépôt ACD', 100000),
('32a3c0c6-0b0f-4173-8e6f-4b1178c51270', 'Suivi dossier auprès du cadastre', 50000),

-- Comptabilité / Finance (c7a72387-ec6b-4e1b-ad34-d02fe1dbd244)
('c7a72387-ec6b-4e1b-ad34-d02fe1dbd244', 'Émission d''attestation fiscale', 15000),
('c7a72387-ec6b-4e1b-ad34-d02fe1dbd244', 'Audit financier express', 150000),

-- Autres services (d5d9c282-3d5f-4a0b-93df-8cd5e150ee18)
('d5d9c282-3d5f-4a0b-93df-8cd5e150ee18', 'Frais généraux d''accès', 5000)
ON CONFLICT DO NOTHING;

-- Automatic profile creation trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'reception'),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
