
-- Meal library: persistent memory for generated/adapted meals
CREATE TABLE public.meal_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  external_recipe_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  instructions TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  substitutions JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  nutrition JSONB DEFAULT '{}'::jsonb,
  dietary_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  category TEXT,
  cuisine TEXT,
  prep_time TEXT,
  source TEXT NOT NULL DEFAULT 'generated',
  generation_context JSONB DEFAULT '{}'::jsonb,
  use_soon_items_used TEXT[] NOT NULL DEFAULT '{}'::text[],
  times_viewed INTEGER NOT NULL DEFAULT 0,
  times_planned INTEGER NOT NULL DEFAULT 0,
  times_cooked INTEGER NOT NULL DEFAULT 0,
  times_skipped INTEGER NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT NULL,
  last_planned_at TIMESTAMP WITH TIME ZONE,
  last_cooked_at TIMESTAMP WITH TIME ZONE,
  is_promoted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_meal_library_user ON public.meal_library(user_id);
CREATE INDEX idx_meal_library_promoted ON public.meal_library(user_id, is_promoted) WHERE is_promoted = true;
CREATE INDEX idx_meal_library_source ON public.meal_library(user_id, source);
CREATE INDEX idx_meal_library_ranking ON public.meal_library(user_id, times_cooked DESC, avg_rating DESC NULLS LAST);

-- Enable RLS
ALTER TABLE public.meal_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own library meals"
ON public.meal_library FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own library meals"
ON public.meal_library FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own library meals"
ON public.meal_library FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own library meals"
ON public.meal_library FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_meal_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_meal_library_updated_at
BEFORE UPDATE ON public.meal_library
FOR EACH ROW
EXECUTE FUNCTION public.update_meal_library_updated_at();
