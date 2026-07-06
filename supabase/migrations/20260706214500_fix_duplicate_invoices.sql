-- 1. Nettoyer les factures en doublon (conserver uniquement la plus ancienne pour chaque visit_id)
DELETE FROM public.invoices 
WHERE id IN (
  SELECT id FROM (
    SELECT id, visit_id, 
           ROW_NUMBER() OVER (PARTITION BY visit_id ORDER BY created_at ASC) as rn
    FROM public.invoices
  ) t
  WHERE t.rn > 1
);

-- 2. Ajouter la contrainte unique sur visit_id pour empêcher les futurs doublons
ALTER TABLE public.invoices 
  ADD CONSTRAINT invoices_visit_id_key UNIQUE (visit_id);

-- 3. Recharger le schéma PostgREST
NOTIFY pgrst, 'reload schema';
