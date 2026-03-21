
-- Shopping list table
CREATE TABLE public.shopping_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT NOT NULL DEFAULT '1',
  checked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own shopping items" ON public.shopping_list FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shopping items" ON public.shopping_list FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shopping items" ON public.shopping_list FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shopping items" ON public.shopping_list FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Waste log table
CREATE TABLE public.waste_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT NOT NULL DEFAULT '1',
  reason TEXT NOT NULL DEFAULT 'expired',
  wasted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.waste_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own waste log" ON public.waste_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own waste log" ON public.waste_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own waste log" ON public.waste_log FOR DELETE TO authenticated USING (auth.uid() = user_id);
