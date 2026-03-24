
CREATE TABLE public.meal_slot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot text NOT NULL DEFAULT 'dinner',
  target_prep_time text DEFAULT '30 min',
  complexity text DEFAULT 'medium',
  servings integer DEFAULT 2,
  quick_bias boolean DEFAULT false,
  family_friendly_bias boolean DEFAULT false,
  pantry_first_bias boolean DEFAULT false,
  budget_friendly_bias boolean DEFAULT false,
  cuisine_preference text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, slot)
);

ALTER TABLE public.meal_slot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own slot settings"
  ON public.meal_slot_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own slot settings"
  ON public.meal_slot_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own slot settings"
  ON public.meal_slot_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own slot settings"
  ON public.meal_slot_settings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
