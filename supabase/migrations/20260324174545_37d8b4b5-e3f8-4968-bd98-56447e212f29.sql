
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_cuisines text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS budget_sensitivity text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS cooking_confidence text DEFAULT 'intermediate',
  ADD COLUMN IF NOT EXISTS primary_goal text DEFAULT 'reduce-waste',
  ADD COLUMN IF NOT EXISTS planning_style text DEFAULT 'help-choose',
  ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}'::text[];
