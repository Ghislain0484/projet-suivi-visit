-- =======================================================
-- MIGRATION: 20261113160000_grh_role_and_service_tasks.sql
-- Description: 
-- 1. Ajout du rôle GRH (Ressources Humaines & Comptabilité)
-- 2. Système complet de gestion des tâches et avancement par service (service_tasks & task_progress_logs)
-- 3. Sécurisation et cloisonnement financier (revenus par service visibles uniquement par le chef de service, finances globales visibles par Direction / GRH / Caissière / Réception)
-- =======================================================

-- 1. Mettre à jour la contrainte de rôle dans la table profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'admin', 'director', 'reception', 'service_manager', 
  'accounting', 'grh', 'cashier', 'collaborator', 'nurse', 'lawyer'
));

-- 2. Création de la table des tâches / projets par service (service_tasks)
CREATE TABLE IF NOT EXISTS public.service_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  estimated_days INTEGER DEFAULT 1,
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  current_stage TEXT DEFAULT 'Démarrage',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('pending', 'in_progress', 'review', 'blocked', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_tasks_service_id ON public.service_tasks(service_id);
CREATE INDEX IF NOT EXISTS idx_service_tasks_assigned_to ON public.service_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_service_tasks_visitor_id ON public.service_tasks(visitor_id);
CREATE INDEX IF NOT EXISTS idx_service_tasks_status ON public.service_tasks(status);

-- 3. Création du journal des pointages / avancement quotidien ou hebdomadaire (task_progress_logs)
CREATE TABLE IF NOT EXISTS public.task_progress_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.service_tasks(id) ON DELETE CASCADE,
  logged_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  progress_percentage INTEGER NOT NULL CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  stage_label TEXT,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('pending', 'in_progress', 'review', 'blocked', 'completed', 'cancelled')),
  blockers TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_progress_logs_task_id ON public.task_progress_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_logs_log_date ON public.task_progress_logs(log_date);

-- 4. Déclencheur automatique de mise à jour de la tâche lors d'un nouveau pointage
CREATE OR REPLACE FUNCTION public.sync_task_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.service_tasks
  SET 
    progress_percentage = NEW.progress_percentage,
    current_stage = COALESCE(NULLIF(NEW.stage_label, ''), current_stage),
    status = CASE 
      WHEN NEW.progress_percentage >= 100 THEN 'completed' 
      ELSE NEW.status 
    END,
    updated_at = NOW()
  WHERE id = NEW.task_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_task_progress ON public.task_progress_logs;
CREATE TRIGGER trg_sync_task_progress
  AFTER INSERT ON public.task_progress_logs
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_progress();

-- 5. Sécurité RLS pour service_tasks
ALTER TABLE public.service_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_tasks_select" ON public.service_tasks;
CREATE POLICY "service_tasks_select" ON public.service_tasks FOR SELECT TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'grh', 'accounting')
  OR service_id = (SELECT service_id FROM public.profiles WHERE id = auth.uid())
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "service_tasks_insert" ON public.service_tasks;
CREATE POLICY "service_tasks_insert" ON public.service_tasks FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role(auth.uid()) IN ('admin', 'director', 'grh', 'reception', 'service_manager')
);

DROP POLICY IF EXISTS "service_tasks_update" ON public.service_tasks;
CREATE POLICY "service_tasks_update" ON public.service_tasks FOR UPDATE TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('admin', 'director', 'grh', 'reception', 'service_manager')
  OR assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "service_tasks_delete" ON public.service_tasks;
CREATE POLICY "service_tasks_delete" ON public.service_tasks FOR DELETE TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('admin', 'director', 'grh')
);

-- 6. Sécurité RLS pour task_progress_logs
ALTER TABLE public.task_progress_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_progress_logs_select" ON public.task_progress_logs;
CREATE POLICY "task_progress_logs_select" ON public.task_progress_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "task_progress_logs_insert" ON public.task_progress_logs;
CREATE POLICY "task_progress_logs_insert" ON public.task_progress_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "task_progress_logs_update" ON public.task_progress_logs;
CREATE POLICY "task_progress_logs_update" ON public.task_progress_logs FOR UPDATE TO authenticated 
USING (auth.uid() = logged_by OR public.get_user_role(auth.uid()) IN ('admin', 'director', 'grh'));

DROP POLICY IF EXISTS "task_progress_logs_delete" ON public.task_progress_logs;
CREATE POLICY "task_progress_logs_delete" ON public.task_progress_logs FOR DELETE TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'grh'));

-- 7. Cloisonnement financier strict sur la table invoices
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'cashier', 'accounting', 'grh')
  OR (
    public.get_user_role(auth.uid()) = 'service_manager'
    AND (
      invoices.responsible_service_id = (SELECT service_id FROM public.profiles WHERE id = auth.uid())
      OR invoices.visit_id IN (
        SELECT v.id FROM public.visits v 
        WHERE v.service_id = (SELECT p.service_id FROM public.profiles p WHERE p.id = auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'accounting', 'grh', 'cashier'));

DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'accounting', 'grh'));

-- 8. Accès Permissions & Congés pour GRH
DROP POLICY IF EXISTS "permissions_select" ON public.permissions;
CREATE POLICY "permissions_select" ON public.permissions FOR SELECT TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception', 'grh', 'accounting')
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = permissions.user_id
      AND p.service_id = (SELECT s.service_id FROM public.profiles s WHERE s.id = auth.uid())
      AND public.get_user_role(auth.uid()) = 'service_manager'
  )
);

DROP POLICY IF EXISTS "permissions_update" ON public.permissions;
CREATE POLICY "permissions_update" ON public.permissions FOR UPDATE TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'grh', 'reception'));

-- Notifier le rechargement du schéma
NOTIFY pgrst, 'reload schema';
