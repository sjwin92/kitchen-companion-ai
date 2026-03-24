
-- User interactions: structured behavioral events
CREATE TABLE public.user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  recipe_id text,
  recipe_title text,
  meal_plan_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own interactions" ON public.user_interactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own interactions" ON public.user_interactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own interactions" ON public.user_interactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_interactions_user_type ON public.user_interactions (user_id, event_type);
CREATE INDEX idx_interactions_recipe ON public.user_interactions (user_id, recipe_id);

-- Staple meals
CREATE TABLE public.staple_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipe_id text NOT NULL,
  title text NOT NULL,
  image text,
  category text,
  meal_slot text DEFAULT 'dinner',
  frequency_hint text DEFAULT 'weekly',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, recipe_id)
);

ALTER TABLE public.staple_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own staples" ON public.staple_meals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own staples" ON public.staple_meals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own staples" ON public.staple_meals
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own staples" ON public.staple_meals
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add status to meal_plans for completion tracking
ALTER TABLE public.meal_plans ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned';

-- Add source tracking to meal_log
ALTER TABLE public.meal_log ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE public.meal_log ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.meal_log ADD COLUMN IF NOT EXISTS rating integer;
