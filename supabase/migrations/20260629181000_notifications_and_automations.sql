-- 1. Create automation_settings table
CREATE TABLE IF NOT EXISTS public.automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- e.g., 'n8n_whatsapp', 'email', 'sms', 'telegram'
  webhook_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  secret_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create notification_recipients table
CREATE TABLE IF NOT EXISTS public.notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT,
  service TEXT,
  groups TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  receive_visit_notifications BOOLEAN DEFAULT true NOT NULL,
  receive_system_notifications BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create notification_logs table
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb NOT NULL,
  status TEXT NOT NULL, -- e.g., 'success', 'failed'
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Triggers for updated_at
CREATE TRIGGER update_automation_settings_updated_at 
BEFORE UPDATE ON public.automation_settings 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_notification_recipients_updated_at 
BEFORE UPDATE ON public.notification_recipients 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. Enable RLS
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- automation_settings
DROP POLICY IF EXISTS "automation_settings_select" ON public.automation_settings;
CREATE POLICY "automation_settings_select" ON public.automation_settings 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "automation_settings_all" ON public.automation_settings;
CREATE POLICY "automation_settings_all" ON public.automation_settings 
  FOR ALL TO authenticated 
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- notification_recipients
DROP POLICY IF EXISTS "notification_recipients_select" ON public.notification_recipients;
CREATE POLICY "notification_recipients_select" ON public.notification_recipients 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "notification_recipients_all" ON public.notification_recipients;
CREATE POLICY "notification_recipients_all" ON public.notification_recipients 
  FOR ALL TO authenticated 
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- notification_logs
DROP POLICY IF EXISTS "notification_logs_select" ON public.notification_logs;
CREATE POLICY "notification_logs_select" ON public.notification_logs 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "notification_logs_insert" ON public.notification_logs;
CREATE POLICY "notification_logs_insert" ON public.notification_logs 
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notification_logs_all" ON public.notification_logs;
CREATE POLICY "notification_logs_all" ON public.notification_logs 
  FOR ALL TO authenticated 
  USING (public.get_user_role(auth.uid()) IN ('admin', 'director'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director'));

-- Reload Postgrest schema
NOTIFY pgrst, 'reload schema';
