
CREATE TABLE public.meal_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_plan_id uuid REFERENCES public.meal_plans(id) ON DELETE SET NULL,
  recipe_id text NOT NULL,
  title text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  would_repeat boolean DEFAULT true,
  notes text DEFAULT NULL,
  meal_slot text DEFAULT 'dinner',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own ratings" ON public.meal_ratings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ratings" ON public.meal_ratings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ratings" ON public.meal_ratings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ratings" ON public.meal_ratings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
