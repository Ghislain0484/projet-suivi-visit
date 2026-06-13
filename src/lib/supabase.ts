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

export type UserRole = 'admin' | 'director' | 'reception' | 'service_manager' | 'accounting';

export type VisitorType = 'client' | 'prospect' | 'supplier' | 'partner' | 'other';

export type VisitStatus = 'in_progress' | 'completed' | 'cancelled';

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
  service_id: string | null;
  comments: string | null;
  status: VisitStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  visitor?: Visitor;
  service?: Service;
}

export interface Invoice {
  id: string;
  visit_id: string;
  is_billable: boolean;
  amount: number;
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
  link: string | null;
  created_at: string;
}
