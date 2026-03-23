
-- Favorite recipes table
CREATE TABLE public.favorite_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipe_id text NOT NULL,
  title text NOT NULL,
  image text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, recipe_id)
);

ALTER TABLE public.favorite_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own favorites" ON public.favorite_recipes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON public.favorite_recipes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.favorite_recipes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Meal plans table
CREATE TABLE public.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipe_id text NOT NULL,
  title text NOT NULL,
  image text,
  planned_date date NOT NULL,
  meal_slot text NOT NULL DEFAULT 'dinner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, planned_date, meal_slot)
);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own meal plans" ON public.meal_plans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal plans" ON public.meal_plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal plans" ON public.meal_plans
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal plans" ON public.meal_plans
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
