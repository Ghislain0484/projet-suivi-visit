import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'director' | 'reception' | 'service_manager' | 'accounting' | 'cashier' | 'collaborator' | 'nurse';

export type VisitorType = 'client' | 'prospect' | 'supplier' | 'partner' | 'other';

export type VisitStatus = 'in_progress' | 'completed' | 'cancelled' | 'traite' | 'en_cours' | 'a_relancer' | 'transforme' | 'annule';

export type PaymentStatus = 'not_invoiced' | 'invoiced' | 'paid' | 'partially_paid' | 'cancelled';

export type ServiceStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'late';

export type FollowUpStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'late';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceItem {
  id: string;
  service_id: string;
  name: string;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  service_id: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Visitor {
  id: string;
  first_name: string;
  last_name: string;
  visitor_type: VisitorType;
  phone: string | null;
  email: string | null;
  company: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Visit {
  id: string;
  visitor_id: string;
  visit_code: string;
  arrival_time: string;
  departure_time: string | null;
  purpose: string;
  has_appointment: boolean;
  person_to_meet: string | null;
  assigned_collaborator_id: string | null;
  observations: string | null;
  report: string | null;
  attachments: string[] | null;
  service_id: string | null;
  comments: string | null;
  status: VisitStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  visitor?: Visitor;
  service?: Service;
  collaborator?: Profile;
  assigned_collaborator?: { id: string; full_name: string; role: UserRole } | null;
}

export interface Invoice {
  id: string;
  visit_id: string;
  is_billable: boolean;
  amount: number;
  amount_paid: number;
  invoice_date: string | null;
  payment_status: PaymentStatus;
  service_status: ServiceStatus;
  expected_duration_days: number;
  deadline: string | null;
  responsible_service_id: string | null;
  created_at: string;
  updated_at: string;
  visit?: Visit;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  service_item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  updated_at: string;
  service_item?: ServiceItem;
}

export interface VisitFollowUp {
  id: string;
  visit_id: string;
  status: FollowUpStatus;
  priority: Priority;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  visit_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Json | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  read_at: string | null;
  response_status: 'pending' | 'accepted' | 'busy' | 'refused';
  link: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  visit_id: string | null;
  visitor_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  assigned_to: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  visitor?: Visitor;
  collaborator?: Profile;
}

export interface HRPresence {
  id: string;
  user_id: string;
  date: string;
  arrival_time: string;
  break_start: string | null;
  break_end: string | null;
  departure_time: string | null;
  qr_code_token: string | null;
  gps_location: string | null;
  status: 'present' | 'pause' | 'mission' | 'displacement' | 'absent' | 'leave' | 'permission';
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Mission {
  id: string;
  user_id: string;
  destination: string;
  purpose: string;
  departure_time: string;
  expected_return: string;
  actual_return: string | null;
  gps_coordinates: string | null;
  status: 'planned' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Permission {
  id: string;
  user_id: string;
  type: 'permission' | 'absence' | 'leave';
  reason: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface MedicalRequest {
  id: string;
  user_id: string;
  request_type: 'consultation' | 'sickness' | 'rest';
  symptoms: string;
  nurse_opinion: string | null;
  prescription: string | null;
  rest_days_granted: number;
  status: 'pending' | 'processed' | 'rejected';
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}
