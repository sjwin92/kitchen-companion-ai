
-- Add lifecycle and content pipeline fields to meal_library
ALTER TABLE public.meal_library
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS quality_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotion_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_user_id uuid,
  ADD COLUMN IF NOT EXISTS recommendation_reason text,
  ADD COLUMN IF NOT EXISTS effort_level text,
  ADD COLUMN IF NOT EXISTS content_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS content_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS youtube_ready boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS script_seed text,
  ADD COLUMN IF NOT EXISTS media_prompt text,
  ADD COLUMN IF NOT EXISTS video_queue_status text DEFAULT 'none';

-- Index for shared meal discovery
CREATE INDEX IF NOT EXISTS idx_meal_library_lifecycle ON public.meal_library (lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_meal_library_quality ON public.meal_library (quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_meal_library_promotion ON public.meal_library (promotion_score DESC);

-- Update RLS: allow reading shared meals by all authenticated users
CREATE POLICY "Authenticated users can read shared meals"
  ON public.meal_library
  FOR SELECT
  TO authenticated
  USING (lifecycle_status = 'shared');

-- Create meal_feedback table for explicit feedback
CREATE TABLE public.meal_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  meal_id uuid NOT NULL REFERENCES public.meal_library(id) ON DELETE CASCADE,
  feedback_type text NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own feedback"
  ON public.meal_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
  ON public.meal_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own feedback"
  ON public.meal_feedback FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_meal_feedback_meal ON public.meal_feedback (meal_id);
CREATE INDEX idx_meal_feedback_user ON public.meal_feedback (user_id);

-- Create ingredient_prices table for cost estimation
CREATE TABLE public.ingredient_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_name text NOT NULL,
  estimated_price_gbp numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'each',
  retailer text DEFAULT 'generic',
  retailer_product_id text,
  retailer_product_url text,
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(ingredient_name, retailer)
);

ALTER TABLE public.ingredient_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ingredient prices"
  ON public.ingredient_prices FOR SELECT TO authenticated
  USING (true);

-- Database function to recalculate meal scores
CREATE OR REPLACE FUNCTION public.recalculate_meal_scores(p_meal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quality numeric;
  v_promotion numeric;
  v_positive_feedback integer;
  v_negative_feedback integer;
BEGIN
  -- Count feedback types
  SELECT
    COUNT(*) FILTER (WHERE feedback_type IN ('loved_it', 'family_liked')),
    COUNT(*) FILTER (WHERE feedback_type IN ('too_complicated', 'took_too_long', 'too_many_missing', 'too_expensive', 'too_high_calorie', 'not_filling', 'family_disliked'))
  INTO v_positive_feedback, v_negative_feedback
  FROM public.meal_feedback
  WHERE meal_id = p_meal_id;

  -- Calculate quality score from meal_library counters + feedback
  SELECT
    (COALESCE(times_cooked, 0) * 3.0)
    + (COALESCE(times_planned, 0) * 2.0)
    + (COALESCE(times_viewed, 0) * 0.5)
    + (COALESCE(avg_rating, 0) * 2.0)
    + (v_positive_feedback * 2.0)
    - (COALESCE(times_skipped, 0) * 1.5)
    - (v_negative_feedback * 1.0)
  INTO v_quality
  FROM public.meal_library
  WHERE id = p_meal_id;

  -- Promotion score: quality + diversity of positive signals
  v_promotion := GREATEST(0, v_quality);

  UPDATE public.meal_library
  SET quality_score = COALESCE(v_quality, 0),
      promotion_score = COALESCE(v_promotion, 0),
      lifecycle_status = CASE
        WHEN COALESCE(v_promotion, 0) >= 15 AND lifecycle_status = 'private' THEN 'validated'
        ELSE lifecycle_status
      END
  WHERE id = p_meal_id;
END;
$$;
