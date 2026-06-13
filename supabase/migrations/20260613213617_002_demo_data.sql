-- Demo data for testing JICO VISIT TRACKER

-- Insert visitor records
INSERT INTO visitors (id, first_name, last_name, visitor_type, phone, email, company, notes) VALUES
('11111111-1111-1111-1111-111111111001', 'Amadou', 'Koné', 'client', '+225 07 00 01 02 03', 'amadou.kone@abidjan-consulting.com', 'Abidjan Consulting', 'Client VIP'),
('11111111-1111-1111-1111-111111111002', 'Fatou', 'Diallo', 'prospect', '+225 05 00 02 03 04', 'fatou.diallo@gmail.com', 'Afrique Com', 'Interetsse par nos services IT'),
('11111111-1111-1111-1111-111111111003', 'Jean-Pierre', 'Mensah', 'supplier', '+225 01 00 03 04 05', 'jp.mensah@techmate.com', 'Tech Mate SARL', 'Fournisseur materiel informatique'),
('11111111-1111-1111-1111-111111111004', 'Marie', 'Bamba', 'partner', '+225 07 00 04 05 06', 'marie.bamba@partnerplus.com', 'Partner Plus', 'Partenaire strategique'),
('11111111-1111-1111-1111-111111111005', 'Ibrahim', 'Touré', 'client', '+225 05 00 05 06 07', 'ibrahim.toure@jico-partner.com', 'JICO Partner', 'Client regulier'),
('11111111-1111-1111-1111-111111111006', 'Aminata', 'Sanogo', 'prospect', '+225 07 00 06 07 08', 'aminata.sanogo@startup.io', 'StartupIO', 'Projet de collaboration en cours'),
('11111111-1111-1111-1111-111111111007', 'Ousmane', 'Coulibaly', 'supplier', '+225 01 00 07 08 09', 'ousmane.c@logistics.ci', 'Global Logistics', 'Transporteur'),
('11111111-1111-1111-1111-111111111008', 'Aissata', 'Konaté', 'client', '+225 05 00 08 09 10', 'aissata.konate@corpplus.com', 'Corp Plus', 'Compte majeur'),
('11111111-1111-1111-1111-111111111009', 'Vincent', 'Kouadio', 'other', '+225 07 00 09 10 11', 'vincent.k@yahoo.fr', NULL, 'Consultant independant'),
('11111111-1111-1111-1111-111111111010', 'Fatimata', 'Barro', 'partner', '+225 01 00 10 11 12', 'fatimata.barro@ngo.org', 'NGO Development', 'ONG partenaire');

-- Insert visits with varying dates (using real service IDs)
INSERT INTO visits (id, visitor_id, arrival_time, departure_time, purpose, has_appointment, person_to_meet, service_id, comments, status) VALUES
-- Today's visits
('22222222-2222-2222-2222-222222222001', '11111111-1111-1111-1111-111111111001', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour', 'Reunion de suivi projet', true, 'M. Kouadio', '17f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Reunion productive', 'completed'),
('22222222-2222-2222-2222-222222222002', '11111111-1111-1111-1111-111111111002', NOW() - INTERVAL '2 hours', NULL, 'Demande de devis pour infrastructure IT', false, NULL, '17f2b27c-350a-41bc-bffe-99fdda2aab8b', NULL, 'in_progress'),
('22222222-2222-2222-2222-222222222003', '11111111-1111-1111-1111-111111111003', NOW() - INTERVAL '1 hour', NULL, 'Livraison de materiel', false, 'Responsable stocks', '32d81751-a260-485e-8b14-80362de13313', 'Commande #CMD-2026-045', 'in_progress'),

-- Yesterday's visits
('22222222-2222-2222-2222-222222222004', '11111111-1111-1111-1111-111111111004', NOW() - INTERVAL '1 day' - INTERVAL '4 hours', NOW() - INTERVAL '1 day' - INTERVAL '2 hours', 'Reunion partenariat', true, 'Mme Bamba', '89341b8b-2858-4f08-9f5c-02167908eab5', 'Accord signe pour extension', 'completed'),
('22222222-2222-2222-2222-222222222005', '11111111-1111-1111-1111-111111111005', NOW() - INTERVAL '1 day' - INTERVAL '3 hours', NOW() - INTERVAL '1 day' - INTERVAL '1 hour', 'Renouvellement contrat maintenance', false, NULL, '17f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Contrat renouvele pour 2 ans', 'completed'),

-- This week's visits
('22222222-2222-2222-2222-222222222006', '11111111-1111-1111-1111-111111111006', NOW() - INTERVAL '3 days' - INTERVAL '2 hours', NOW() - INTERVAL '3 days', 'Presentation solution cloud', true, 'M. Touré', '17f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Demo effectuee - attente feedback', 'completed'),
('22222222-2222-2222-2222-222222222007', '11111111-1111-1111-1111-111111111007', NOW() - INTERVAL '4 days' - INTERVAL '1 hour', NOW() - INTERVAL '4 days', 'Enlevement colis', false, NULL, '32d81751-a260-485e-8b14-80362de13313', NULL, 'completed'),

-- Older visits (this month)
('22222222-2222-2222-2222-222222222008', '11111111-1111-1111-1111-111111111008', NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days' - INTERVAL '4 hours', 'Reunion annuelle de compte rendu', true, 'Directeur General', '89341b8b-2858-4f08-9f5c-02167908eab5', 'Revue annuelle completee', 'completed'),
('22222222-2222-2222-2222-222222222009', '11111111-1111-1111-1111-111111111009', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days' - INTERVAL '2 hours', 'Consultation technique', false, 'M. Kouadio', '17f2b27c-350a-41bc-bffe-99fdda2aab8b', 'Conseils pour migration systeme', 'completed'),
('22222222-2222-2222-2222-222222222010', '11111111-1111-1111-1111-111111111010', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days' - INTERVAL '3 hours', 'Reunion coordination projet social', true, 'Mme Barro', '32a3c0c6-0b0f-4173-8e6f-4b1178c51270', 'Planification prochaines actions', 'completed');

-- Insert invoices (linked to visits as billable entries)
INSERT INTO invoices (id, visit_id, is_billable, amount, invoice_date, payment_status, service_status, expected_duration_days, deadline, responsible_service_id) VALUES
('33333333-3333-3333-3333-333333333001', '22222222-2222-2222-2222-222222222001', true, 850000, NOW()::date, 'paid', 'completed', 7, NOW()::date - INTERVAL '7 days', '17f2b27c-350a-41bc-bffe-99fdda2aab8b'),
('33333333-3333-3333-3333-333333333002', '22222222-2222-2222-2222-222222222002', true, 2500000, NULL, 'not_invoiced', 'pending', 14, NULL, '17f2b27c-350a-41bc-bffe-99fdda2aab8b'),
('33333333-3333-3333-3333-333333333003', '22222222-2222-2222-2222-222222222004', true, 1500000, NOW()::date - INTERVAL '1 day', 'invoiced', 'in_progress', 30, NOW()::date + INTERVAL '29 days', '89341b8b-2858-4f08-9f5c-02167908eab5'),
('33333333-3333-3333-3333-333333333004', '22222222-2222-2222-2222-222222222005', true, 450000, NOW()::date - INTERVAL '1 day', 'invoiced', 'completed', 7, NOW()::date + INTERVAL '6 days', '17f2b27c-350a-41bc-bffe-99fdda2aab8b'),
('33333333-3333-3333-3333-333333333005', '22222222-2222-2222-2222-222222222006', true, 1200000, NOW()::date - INTERVAL '3 days', 'partially_paid', 'in_progress', 21, NOW()::date + INTERVAL '17 days', '17f2b27c-350a-41bc-bffe-99fdda2aab8b'),
('33333333-3333-3333-3333-333333333006', '22222222-2222-2222-2222-222222222003', false, 0, NULL, 'not_invoiced', 'pending', 3, NOW()::date + INTERVAL '2 days', '32d81751-a260-485e-8b14-80362de13313');

-- Insert overdue invoices
INSERT INTO invoices (id, visit_id, is_billable, amount, invoice_date, payment_status, service_status, expected_duration_days, deadline, responsible_service_id) VALUES
('33333333-3333-3333-3333-333333333007', '22222222-2222-2222-2222-222222222007', true, 180000, NOW()::date - INTERVAL '5 days', 'invoiced', 'late', 5, NOW()::date - INTERVAL '8 days', '32d81751-a260-485e-8b14-80362de13313'),
('33333333-3333-3333-3333-333333333008', '22222222-2222-2222-2222-222222222009', true, 350000, NOW()::date - INTERVAL '10 days', 'invoiced', 'blocked', 7, NOW()::date - INTERVAL '3 days', '17f2b27c-350a-41bc-bffe-99fdda2aab8b');

-- Insert follow-ups
INSERT INTO visit_followups (id, visit_id, status, priority, due_date) VALUES
('44444444-4444-4444-4444-444444444001', '22222222-2222-2222-2222-222222222002', 'in_progress', 'high', NOW()::date + INTERVAL '5 days'),
('44444444-4444-4444-4444-444444444002', '22222222-2222-2222-2222-222222222003', 'pending', 'normal', NOW()::date + INTERVAL '2 days'),
('44444444-4444-4444-4444-444444444003', '22222222-2222-2222-2222-222222222006', 'pending', 'low', NOW()::date + INTERVAL '14 days');

-- Insert urgent follow-up
INSERT INTO visit_followups (id, visit_id, status, priority, due_date) VALUES
('44444444-4444-4444-4444-444444444004', '22222222-2222-2222-2222-222222222002', 'blocked', 'urgent', NOW()::date - INTERVAL '2 days');
