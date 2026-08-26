-- Trigger-only signup function: it must never be a public RPC endpoint.
alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;

-- Cover foreign keys used during user deletion and relational joins.
create index if not exists beta_invites_created_by_idx
  on private.beta_invites (created_by)
  where created_by is not null;
create index if not exists beta_invites_redeemed_user_idx
  on private.beta_invites (redeemed_user_id)
  where redeemed_user_id is not null;
create index if not exists meal_plans_leftover_parent_idx
  on public.meal_plans (is_leftover_of)
  where is_leftover_of is not null;
create index if not exists meal_ratings_plan_idx
  on public.meal_ratings (meal_plan_id)
  where meal_plan_id is not null;
create index if not exists meal_ratings_user_idx
  on public.meal_ratings (user_id);
create index if not exists recipe_reviews_reviewer_idx
  on public.recipe_reviews (reviewer_user_id);

comment on table public.ai_cache is
  'Server-only AI response cache. RLS intentionally has no client policies, so Data API access is denied.';

comment on function public.complete_onboarding(jsonb) is
  'Authenticated RPC; validates auth.uid() and writes only the caller profile.';
comment on function public.transition_inventory_item(uuid, text, numeric, text) is
  'Authenticated RPC; validates auth.uid() and locks only caller-owned inventory.';
comment on function public.move_shopping_items_to_inventory(jsonb) is
  'Authenticated RPC; validates auth.uid() and moves only caller-owned shopping rows.';
comment on function public.move_meal_plan(uuid, date, text) is
  'Authenticated RPC; validates auth.uid() and updates only caller-owned meal plans.';
comment on function public.confirm_meal_log(jsonb, uuid[], uuid, text, text, text, integer) is
  'Authenticated RPC; validates auth.uid(), ownership and nutrition bounds before atomic writes.';
comment on function public.create_beta_invite(text, text, timestamptz) is
  'Admin/service RPC; rejects callers unless private.is_admin() or service_role is true.';
comment on function public.review_catalogue_recipe(uuid, text, jsonb, text) is
  'Admin/service RPC; private.is_admin() is checked before any catalogue mutation.';
