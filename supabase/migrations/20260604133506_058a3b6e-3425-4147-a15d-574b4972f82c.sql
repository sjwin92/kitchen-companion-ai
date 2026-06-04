
-- 1. Profile fields for budget + lunchbox
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_budget_gbp numeric,
  ADD COLUMN IF NOT EXISTS lunchbox_count integer DEFAULT 0;

-- 2. Meal plan fields for bulk-cook leftovers
ALTER TABLE public.meal_plans
  ADD COLUMN IF NOT EXISTS bulk_servings integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_leftover_of uuid REFERENCES public.meal_plans(id) ON DELETE SET NULL;

-- 3. Receipt reconciliation log
CREATE TABLE IF NOT EXISTS public.receipt_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  total_gbp numeric NOT NULL DEFAULT 0,
  matched_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  unmatched_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  retailer text,
  receipt_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_reconciliations TO authenticated;
GRANT ALL ON public.receipt_reconciliations TO service_role;

ALTER TABLE public.receipt_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reconciliations"
  ON public.receipt_reconciliations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reconciliations"
  ON public.receipt_reconciliations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reconciliations"
  ON public.receipt_reconciliations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS receipt_reconciliations_user_date_idx
  ON public.receipt_reconciliations (user_id, created_at DESC);
