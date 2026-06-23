-- =======================================================
-- MIGRATION: 20260623181500_interns_kiosk.sql
-- Description: Création de la table interns pour les stagiaires sans compte de connexion, et mise à jour de la table hr_presences pour supporter le pointage par borne.
-- =======================================================

-- 1. Créer la table interns
CREATE TABLE IF NOT EXISTS public.interns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS pour la table interns
ALTER TABLE public.interns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interns_select" ON public.interns;
CREATE POLICY "interns_select" ON public.interns FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "interns_insert" ON public.interns;
CREATE POLICY "interns_insert" ON public.interns FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

DROP POLICY IF EXISTS "interns_update" ON public.interns;
CREATE POLICY "interns_update" ON public.interns FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));

DROP POLICY IF EXISTS "interns_delete" ON public.interns;
CREATE POLICY "interns_delete" ON public.interns FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) IN ('admin', 'director', 'reception'));


-- 2. Adapter la table hr_presences pour accueillir les stagiaires
-- Rendre user_id nullable
ALTER TABLE public.hr_presences ALTER COLUMN user_id DROP NOT NULL;

-- Ajouter la colonne intern_id
ALTER TABLE public.hr_presences ADD COLUMN IF NOT EXISTS intern_id UUID REFERENCES public.interns(id) ON DELETE CASCADE;

-- Ajouter les contraintes d'unicité et de validation
ALTER TABLE public.hr_presences DROP CONSTRAINT IF EXISTS check_user_or_intern;
ALTER TABLE public.hr_presences ADD CONSTRAINT check_user_or_intern CHECK (
  (user_id IS NOT NULL AND intern_id IS NULL) OR 
  (user_id IS NULL AND intern_id IS NOT NULL)
);

ALTER TABLE public.hr_presences DROP CONSTRAINT IF EXISTS unique_intern_date;
ALTER TABLE public.hr_presences ADD CONSTRAINT unique_intern_date UNIQUE (intern_id, date);


-- 3. Trigger d'auto-update pour la table interns
DROP TRIGGER IF EXISTS update_interns_updated_at ON public.interns;
CREATE TRIGGER update_interns_updated_at BEFORE UPDATE ON public.interns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- 4. Fonction RPC sécurisée pour le pointage Borne/Kiosque (pour collaborateurs ET stagiaires)
CREATE OR REPLACE FUNCTION public.kiosk_check_in(
  target_user_id UUID DEFAULT NULL,
  target_intern_id UUID DEFAULT NULL,
  action_type TEXT DEFAULT NULL, -- 'arrival', 'break_start', 'break_end', 'departure'
  gps_val TEXT DEFAULT NULL,
  lat NUMERIC DEFAULT NULL,
  lng NUMERIC DEFAULT NULL,
  accuracy NUMERIC DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  calling_role TEXT;
  target_name TEXT;
  today_date DATE := CURRENT_DATE;
  now_time TIMESTAMPTZ := NOW();
BEGIN
  -- Vérifier qu'une seule cible est spécifiée
  IF (target_user_id IS NOT NULL AND target_intern_id IS NOT NULL) OR (target_user_id IS NULL AND target_intern_id IS NULL) THEN
    RAISE EXCEPTION 'Veuillez spécifier soit un collaborateur (target_user_id) soit un stagiaire (target_intern_id).';
  END IF;

  -- Vérifier le rôle de l'appelant (l'assistante, le DG ou l'admin)
  calling_role := public.get_user_role(auth.uid());
  IF calling_role NOT IN ('admin', 'director', 'reception') THEN
    RAISE EXCEPTION 'Non autorisé : Seuls les administrateurs, les directeurs et les assistants de direction peuvent effectuer cette opération.';
  END IF;

  -- Récupérer le nom complet de la cible
  IF target_user_id IS NOT NULL THEN
    SELECT full_name INTO target_name FROM public.profiles WHERE id = target_user_id;
  ELSE
    SELECT full_name INTO target_name FROM public.interns WHERE id = target_intern_id;
  END IF;

  IF target_name IS NULL THEN
    RAISE EXCEPTION 'Cible de pointage introuvable.';
  END IF;

  -- Enregistrement de l'arrivée (Insert)
  IF action_type = 'arrival' THEN
    -- Vérification de doublon
    IF target_user_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.hr_presences WHERE user_id = target_user_id AND date = today_date) THEN
        RAISE EXCEPTION 'Ce collaborateur a déjà pointé son arrivée aujourd''hui.';
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM public.hr_presences WHERE intern_id = target_intern_id AND date = today_date) THEN
        RAISE EXCEPTION 'Ce stagiaire a déjà pointé son arrivée aujourd''hui.';
      END IF;
    END IF;

    INSERT INTO public.hr_presences (
      user_id,
      intern_id,
      employee_name,
      date,
      arrival_time,
      status,
      gps_location,
      check_in_latitude,
      check_in_longitude,
      location_accuracy,
      qr_code_version
    ) VALUES (
      target_user_id,
      target_intern_id,
      target_name,
      today_date,
      now_time,
      'present',
      gps_val,
      lat,
      lng,
      accuracy,
      'kiosk'
    );

  -- Enregistrement des autres actions (Update)
  ELSE
    -- Vérifier que l'arrivée existe
    IF target_user_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.hr_presences WHERE user_id = target_user_id AND date = today_date) THEN
        RAISE EXCEPTION 'Pointage d''arrivée introuvable pour aujourd''hui.';
      END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.hr_presences WHERE intern_id = target_intern_id AND date = today_date) THEN
        RAISE EXCEPTION 'Pointage d''arrivée introuvable pour aujourd''hui.';
      END IF;
    END IF;

    IF action_type = 'break_start' THEN
      IF target_user_id IS NOT NULL THEN
        UPDATE public.hr_presences SET break_start = now_time, status = 'pause', updated_at = now_time
        WHERE user_id = target_user_id AND date = today_date;
      ELSE
        UPDATE public.hr_presences SET break_start = now_time, status = 'pause', updated_at = now_time
        WHERE intern_id = target_intern_id AND date = today_date;
      END IF;

    ELSIF action_type = 'break_end' THEN
      IF target_user_id IS NOT NULL THEN
        UPDATE public.hr_presences SET break_end = now_time, status = 'present', updated_at = now_time
        WHERE user_id = target_user_id AND date = today_date;
      ELSE
        UPDATE public.hr_presences SET break_end = now_time, status = 'present', updated_at = now_time
        WHERE intern_id = target_intern_id AND date = today_date;
      END IF;

    ELSIF action_type = 'departure' THEN
      IF target_user_id IS NOT NULL THEN
        UPDATE public.hr_presences SET departure_time = now_time, status = 'departed', check_out_latitude = lat, check_out_longitude = lng, updated_at = now_time
        WHERE user_id = target_user_id AND date = today_date;
      ELSE
        UPDATE public.hr_presences SET departure_time = now_time, status = 'departed', check_out_latitude = lat, check_out_longitude = lng, updated_at = now_time
        WHERE intern_id = target_intern_id AND date = today_date;
      END IF;

    ELSE
      RAISE EXCEPTION 'Action de pointage inconnue : %', action_type;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recharger PostgREST
NOTIFY pgrst, 'reload schema';
