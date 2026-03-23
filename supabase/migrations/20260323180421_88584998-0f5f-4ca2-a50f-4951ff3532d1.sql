
CREATE TABLE public.meal_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Logged Meal',
  image_url TEXT,
  calories INTEGER,
  protein_g NUMERIC(6,1),
  carbs_g NUMERIC(6,1),
  fat_g NUMERIC(6,1),
  identified_ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  deducted_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  meal_plan_id UUID REFERENCES public.meal_plans(id) ON DELETE SET NULL,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own meal logs" ON public.meal_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal logs" ON public.meal_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal logs" ON public.meal_log FOR DELETE TO authenticated USING (auth.uid() = user_id);
