-- Kitchen Companion public-beta foundation.
-- Adds an invite-only auth gate, canonical recipe catalogue, creator recipe
-- books, inventory history, nutrition provenance, private meal images, and
-- atomic state transitions while preserving the existing application tables.

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role, public;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- One-time, email-bound beta invitations. Only hashes are stored.
create table private.beta_invites (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  code_hash text not null,
  expires_at timestamptz not null,
  reserved_user_id uuid,
  redeemed_user_id uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint beta_invites_code_hash_length check (length(code_hash) = 64),
  constraint beta_invites_redeemed_consistent check (
    (redeemed_at is null and redeemed_user_id is null)
    or (redeemed_at is not null and redeemed_user_id is not null)
  )
);
create unique index beta_invites_open_email_idx
  on private.beta_invites (email)
  where redeemed_at is null;
create unique index beta_invites_code_hash_idx on private.beta_invites (code_hash);

create or replace function private.hook_require_beta_invite(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email extensions.citext := lower(trim(event -> 'user' ->> 'email'));
  v_code text := trim(event -> 'user' -> 'user_metadata' ->> 'invite_code');
  v_user_id uuid := (event -> 'user' ->> 'id')::uuid;
  v_invite_id uuid;
begin
  if v_email is null or v_code is null or length(v_code) < 12 then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'A valid beta invitation is required.'
    ));
  end if;

  update private.beta_invites
  set reserved_user_id = v_user_id
  where email = v_email
    and code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
    and redeemed_at is null
    and expires_at > now()
    and (reserved_user_id is null or reserved_user_id = v_user_id)
  returning id into v_invite_id;

  if v_invite_id is null then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'This invitation is invalid, expired, or already used.'
    ));
  end if;

  return '{}'::jsonb;
end;
$$;
revoke execute on function private.hook_require_beta_invite(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.hook_require_beta_invite(jsonb) to supabase_auth_admin;

create or replace function private.finish_beta_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.beta_invites
  set redeemed_user_id = new.id,
      redeemed_at = now(),
      reserved_user_id = null
  where reserved_user_id = new.id
    and redeemed_at is null;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'invite_code'
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists finish_beta_invite_after_signup on auth.users;
create trigger finish_beta_invite_after_signup
after insert on auth.users
for each row execute function private.finish_beta_invite();

-- Creator and recipe-book primitives. Purchases are intentionally not
-- implemented yet; recipe_book_access is the future entitlement boundary.
create table public.creators (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  bio text,
  avatar_path text,
  website_url text,
  social_links jsonb not null default '{}'::jsonb,
  verified boolean not null default false,
  review_status text not null default 'draft'
    check (review_status in ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_books (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete set null,
  slug text not null unique,
  title text not null,
  subtitle text,
  description text,
  cover_path text,
  content_version integer not null default 1 check (content_version > 0),
  review_status text not null default 'draft'
    check (review_status in ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  access_model text not null default 'included'
    check (access_model in ('included', 'invite', 'purchase_future')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete set null,
  slug text not null unique,
  title text not null,
  description text,
  image_path text,
  youtube_url text,
  audio_url text,
  servings numeric(6,2) not null default 2 check (servings > 0),
  prep_minutes integer not null default 0 check (prep_minutes >= 0),
  cook_minutes integer not null default 0 check (cook_minutes >= 0),
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'advanced')),
  cuisine_tags text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  allergen_tags text[] not null default '{}',
  meal_types text[] not null default array['dinner']::text[]
    check (meal_types <@ array['breakfast', 'lunch', 'dinner', 'snack', 'lunchbox']::text[]),
  instructions jsonb not null default '[]'::jsonb,
  nutrition jsonb not null default '{}'::jsonb,
  estimated_cost_low_gbp numeric(10,2),
  estimated_cost_high_gbp numeric(10,2),
  price_estimate_as_of date,
  source_type text not null default 'original'
    check (source_type in ('original', 'creator', 'user_submission', 'ai_assisted')),
  content_version integer not null default 1 check (content_version > 0),
  review_status text not null default 'draft'
    check (review_status in ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_cost_range check (
    estimated_cost_low_gbp is null
    or estimated_cost_high_gbp is null
    or estimated_cost_low_gbp <= estimated_cost_high_gbp
  )
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  name text not null,
  normalized_name text not null,
  quantity numeric(10,3),
  unit text,
  preparation text,
  optional boolean not null default false,
  aisle text,
  unique (recipe_id, position)
);

create table public.recipe_book_recipes (
  recipe_book_id uuid not null references public.recipe_books(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  section_title text,
  primary key (recipe_book_id, recipe_id),
  unique (recipe_book_id, position)
);

create table public.recipe_book_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_book_id uuid not null references public.recipe_books(id) on delete cascade,
  access_source text not null default 'beta'
    check (access_source in ('beta', 'creator_grant', 'admin_grant', 'purchase_future')),
  external_reference text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, recipe_book_id)
);

create table public.user_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  image_path text,
  youtube_url text,
  servings numeric(6,2) not null default 2 check (servings > 0),
  ingredients jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  nutrition jsonb not null default '{}'::jsonb,
  provenance text not null default 'user' check (provenance in ('user', 'ai_assisted', 'imported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_recipe_id uuid not null references public.user_recipes(id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'changes_requested', 'approved', 'rejected')),
  reviewer_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_recipe_id)
);

create table public.recipe_memory (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  times_viewed integer not null default 0 check (times_viewed >= 0),
  times_planned integer not null default 0 check (times_planned >= 0),
  times_cooked integer not null default 0 check (times_cooked >= 0),
  times_skipped integer not null default 0 check (times_skipped >= 0),
  rating numeric(3,2) check (rating between 1 and 5),
  last_viewed_at timestamptz,
  last_planned_at timestamptz,
  last_cooked_at timestamptz,
  primary key (user_id, recipe_id)
);

-- Some legacy projects recorded the meal-feedback migration without retaining
-- the table. Keep the beta migration portable across those projects and clean
-- local rebuilds without replacing data where the table already exists.
create table if not exists public.meal_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid not null references public.meal_library(id) on delete cascade,
  feedback_type text not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.meal_feedback enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'meal_feedback'
      and policyname = 'Users can read own feedback'
  ) then
    create policy "Users can read own feedback"
      on public.meal_feedback for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'meal_feedback'
      and policyname = 'Users can insert own feedback'
  ) then
    create policy "Users can insert own feedback"
      on public.meal_feedback for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'meal_feedback'
      and policyname = 'Users can delete own feedback'
  ) then
    create policy "Users can delete own feedback"
      on public.meal_feedback for delete to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end
$$;
grant select, insert, delete on public.meal_feedback to authenticated;
create index if not exists idx_meal_feedback_meal on public.meal_feedback (meal_id);
create index if not exists idx_meal_feedback_user on public.meal_feedback (user_id);

-- Inventory is event-backed. Expiry freshness is derived from expiry_date.
alter table public.food_items
  add column if not exists quantity_value numeric(12,3),
  add column if not exists unit text,
  add column if not exists lifecycle_state text not null default 'available',
  add column if not exists provenance text not null default 'user',
  add column if not exists confidence numeric(4,3),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists version integer not null default 1;

alter table public.food_items
  add constraint food_items_lifecycle_state_check
    check (lifecycle_state in ('available', 'reserved', 'consumed', 'wasted', 'discarded')),
  add constraint food_items_provenance_check
    check (provenance in ('actual', 'user', 'barcode', 'receipt_estimate', 'vision_estimate')),
  add constraint food_items_confidence_check
    check (confidence is null or confidence between 0 and 1),
  add constraint food_items_quantity_value_check
    check (quantity_value is null or quantity_value >= 0),
  add constraint food_items_version_check check (version > 0);

update public.food_items
set expiry_date = date_added + days_until_expiry
where expiry_date is null;

create or replace function public.food_freshness(p_expiry_date date)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_expiry_date is null then 'unknown'
    when p_expiry_date < current_date then 'expired'
    when p_expiry_date = current_date then 'use_today'
    when p_expiry_date <= current_date + 3 then 'use_soon'
    else 'okay'
  end
$$;

create table public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_item_id uuid references public.food_items(id) on delete set null,
  event_type text not null
    check (event_type in ('added', 'adjusted', 'reserved', 'released', 'consumed', 'wasted', 'discarded')),
  quantity_delta numeric(12,3),
  unit text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace view public.current_inventory
with (security_invoker = true)
as
select
  food_items.*,
  public.food_freshness(food_items.expiry_date) as freshness_state,
  greatest(food_items.expiry_date - current_date, 0) as derived_days_until_expiry
from public.food_items
where food_items.lifecycle_state in ('available', 'reserved');

-- Nutrition is a personal estimate with ranges, confidence and provenance.
alter table public.meal_log
  add column if not exists image_path text,
  add column if not exists image_delete_after timestamptz,
  add column if not exists calorie_low integer,
  add column if not exists calorie_high integer,
  add column if not exists protein_low_g numeric(7,1),
  add column if not exists protein_high_g numeric(7,1),
  add column if not exists carbs_low_g numeric(7,1),
  add column if not exists carbs_high_g numeric(7,1),
  add column if not exists fat_low_g numeric(7,1),
  add column if not exists fat_high_g numeric(7,1),
  add column if not exists confidence numeric(4,3),
  add column if not exists provenance text not null default 'user_confirmed',
  add column if not exists estimate_model text,
  add column if not exists confirmed_at timestamptz;

alter table public.meal_log
  add constraint meal_log_confidence_check check (confidence is null or confidence between 0 and 1),
  add constraint meal_log_provenance_check
    check (provenance in ('manual', 'user_confirmed', 'vision_estimate', 'recipe_calculated')),
  add constraint meal_log_calorie_range_check
    check (calorie_low is null or calorie_high is null or calorie_low <= calorie_high);

create table public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  usage_kind text not null check (usage_kind in ('vision', 'text', 'image')),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date, usage_kind)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  enabled boolean not null default true,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expiry_reminders boolean not null default true,
  notify_hour smallint not null default 9 check (notify_hour between 0 and 23),
  timezone text not null default 'Europe/London',
  last_expiry_sent_on date,
  updated_at timestamptz not null default now()
);

-- Explicit RLS and grants for the new Data API surface.
alter table public.creators enable row level security;
alter table public.recipe_books enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_book_recipes enable row level security;
alter table public.recipe_book_access enable row level security;
alter table public.user_recipes enable row level security;
alter table public.recipe_submissions enable row level security;
alter table public.recipe_memory enable row level security;
alter table public.inventory_events enable row level security;
alter table public.ai_usage_daily enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;

create policy creators_read_approved on public.creators for select to authenticated
  using (review_status = 'approved' or (select private.is_admin()));
create policy creators_admin_all on public.creators for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy recipe_books_read_available on public.recipe_books for select to authenticated
  using (
    review_status = 'approved'
    and (
      access_model = 'included'
      or exists (
        select 1 from public.recipe_book_access a
        where a.recipe_book_id = id
          and a.user_id = (select auth.uid())
          and a.revoked_at is null
      )
    )
    or (select private.is_admin())
  );
create policy recipe_books_admin_all on public.recipe_books for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy recipes_read_approved on public.recipes for select to authenticated
  using (review_status = 'approved' or (select private.is_admin()));
create policy recipes_admin_all on public.recipes for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy recipe_ingredients_read_approved on public.recipe_ingredients for select to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and (r.review_status = 'approved' or (select private.is_admin()))
  ));
create policy recipe_ingredients_admin_all on public.recipe_ingredients for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy recipe_book_recipes_read on public.recipe_book_recipes for select to authenticated
  using (exists (
    select 1 from public.recipe_books b
    where b.id = recipe_book_id
      and (b.review_status = 'approved' or (select private.is_admin()))
  ));
create policy recipe_book_recipes_admin_all on public.recipe_book_recipes for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy recipe_book_access_own_read on public.recipe_book_access for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));
create policy recipe_book_access_admin_all on public.recipe_book_access for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy user_recipes_own_all on public.user_recipes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy recipe_submissions_own_read on public.recipe_submissions for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));
create policy recipe_submissions_own_insert on public.recipe_submissions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy recipe_submissions_admin_update on public.recipe_submissions for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy recipe_memory_own_all on public.recipe_memory for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy inventory_events_own_read on public.inventory_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy ai_usage_own_read on public.ai_usage_daily for select to authenticated
  using ((select auth.uid()) = user_id);
create policy push_subscriptions_own_all on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy notification_preferences_own_all on public.notification_preferences for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select on public.creators, public.recipe_books, public.recipes,
  public.recipe_ingredients, public.recipe_book_recipes, public.current_inventory to authenticated;
grant select on public.recipe_book_access, public.inventory_events, public.ai_usage_daily to authenticated;
grant select, insert, update, delete on public.user_recipes, public.recipe_memory to authenticated;
grant select, insert on public.recipe_submissions to authenticated;
grant select, insert, update, delete on public.push_subscriptions, public.notification_preferences to authenticated;
grant select, insert, update, delete on public.creators, public.recipe_books, public.recipes,
  public.recipe_ingredients, public.recipe_book_recipes, public.recipe_book_access,
  public.recipe_submissions to service_role;
grant select, insert, update, delete on public.inventory_events, public.ai_usage_daily to service_role;
grant select, insert, update, delete on public.push_subscriptions, public.notification_preferences to service_role;

-- Supabase no longer auto-exposes newly created tables through the Data API.
-- Restore only the legacy app surfaces that already have ownership RLS; the
-- absence of an RLS policy still denies an operation even when it is granted.
grant select, insert, update, delete on
  public.profiles,
  public.food_items,
  public.shopping_list,
  public.waste_log,
  public.favorite_recipes,
  public.meal_plans,
  public.meal_log,
  public.user_interactions,
  public.staple_meals,
  public.meal_library,
  public.meal_feedback,
  public.meal_slot_settings,
  public.meal_ratings,
  public.receipt_reconciliations
to authenticated;
grant select on public.ingredient_prices to authenticated;
grant execute on function public.food_freshness(date) to authenticated;
grant select on public.current_inventory to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.food_items,
  public.shopping_list,
  public.waste_log,
  public.favorite_recipes,
  public.meal_plans,
  public.meal_log,
  public.user_interactions,
  public.staple_meals,
  public.meal_library,
  public.meal_feedback,
  public.meal_slot_settings,
  public.meal_ratings,
  public.ingredient_prices,
  public.receipt_reconciliations
to service_role;

-- Repair existing UPDATE policies so ownership cannot be reassigned.
drop policy if exists "Users can update own profile" on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "Users can update own food items" on public.food_items;
create policy food_items_update_own on public.food_items for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own shopping items" on public.shopping_list;
create policy shopping_list_update_own on public.shopping_list for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own meal plans" on public.meal_plans;
create policy meal_plans_update_own on public.meal_plans for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own slot settings" on public.meal_slot_settings;
create policy meal_slot_settings_update_own on public.meal_slot_settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own ratings" on public.meal_ratings;
create policy meal_ratings_update_own on public.meal_ratings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own library meals" on public.meal_library;
create policy meal_library_update_own on public.meal_library for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own staples" on public.staple_meals;
create policy staple_meals_update_own on public.staple_meals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- All client-callable privileged functions validate auth.uid() explicitly.
create or replace function public.complete_onboarding(p_preferences jsonb)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.profiles;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  update public.profiles
  set display_name = coalesce(p_preferences ->> 'displayName', display_name),
      household_size = coalesce((p_preferences ->> 'householdSize')::integer, household_size),
      dietary_preferences = coalesce(
        array(select jsonb_array_elements_text(p_preferences -> 'dietaryPreferences')),
        dietary_preferences
      ),
      disliked_ingredients = coalesce(
        array(select jsonb_array_elements_text(p_preferences -> 'dislikedIngredients')),
        disliked_ingredients
      ),
      preferred_cuisines = coalesce(
        array(select jsonb_array_elements_text(p_preferences -> 'preferredCuisines')),
        preferred_cuisines
      ),
      allergies = coalesce(
        array(select jsonb_array_elements_text(p_preferences -> 'allergies')),
        allergies
      ),
      max_prep_time = coalesce((p_preferences ->> 'maxPrepTime')::integer, max_prep_time),
      daily_calorie_goal = coalesce((p_preferences ->> 'dailyCalorieGoal')::integer, daily_calorie_goal),
      onboarding_complete = true,
      updated_at = now()
  where id = v_user_id
  returning * into v_profile;

  if v_profile.id is null then raise exception 'Profile not found'; end if;
  return v_profile;
end;
$$;

create or replace function public.transition_inventory_item(
  p_item_id uuid,
  p_to_state text,
  p_quantity_delta numeric default null,
  p_reason text default null
)
returns public.food_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_item public.food_items;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_to_state not in ('available', 'reserved', 'consumed', 'wasted', 'discarded') then
    raise exception 'Invalid inventory state';
  end if;

  select * into v_item from public.food_items
  where id = p_item_id and user_id = v_user_id
  for update;
  if v_item.id is null then raise exception 'Inventory item not found'; end if;

  update public.food_items
  set lifecycle_state = p_to_state,
      quantity_value = case
        when p_quantity_delta is null then quantity_value
        else greatest(coalesce(quantity_value, 0) + p_quantity_delta, 0)
      end,
      version = version + 1,
      updated_at = now()
  where id = p_item_id
  returning * into v_item;

  insert into public.inventory_events (
    user_id, food_item_id, event_type, quantity_delta, unit, reason
  ) values (
    v_user_id,
    p_item_id,
    case p_to_state
      when 'available' then 'released'
      when 'reserved' then 'reserved'
      when 'consumed' then 'consumed'
      when 'wasted' then 'wasted'
      else 'discarded'
    end,
    p_quantity_delta,
    v_item.unit,
    p_reason
  );

  if p_to_state = 'wasted' then
    insert into public.waste_log (user_id, name, quantity, reason)
    values (v_user_id, v_item.name, v_item.quantity, coalesce(p_reason, 'expired'));
  end if;
  return v_item;
end;
$$;

create or replace function public.move_shopping_items_to_inventory(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_input jsonb;
  v_shopping public.shopping_list;
  v_food_id uuid;
  v_count integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Items must be an array'; end if;

  for v_input in select value from jsonb_array_elements(p_items) order by value ->> 'id'
  loop
    select * into v_shopping from public.shopping_list
    where id = (v_input ->> 'id')::uuid and user_id = v_user_id and checked = true
    for update;
    if v_shopping.id is null then raise exception 'Checked shopping item not found'; end if;

    insert into public.food_items (
      user_id, name, quantity, quantity_value, unit, location, date_added,
      days_until_expiry, expiry_date, status, lifecycle_state, provenance
    ) values (
      v_user_id,
      v_shopping.name,
      v_shopping.quantity,
      nullif(v_input ->> 'quantityValue', '')::numeric,
      nullif(v_input ->> 'unit', ''),
      coalesce(nullif(v_input ->> 'location', ''), 'cupboard'),
      current_date,
      coalesce((v_input ->> 'daysUntilExpiry')::integer, 30),
      coalesce((v_input ->> 'expiryDate')::date, current_date + coalesce((v_input ->> 'daysUntilExpiry')::integer, 30)),
      'okay', 'available', 'actual'
    ) returning id into v_food_id;

    insert into public.inventory_events (user_id, food_item_id, event_type, metadata)
    values (v_user_id, v_food_id, 'added', jsonb_build_object('source', 'shopping_list'));
    delete from public.shopping_list where id = v_shopping.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.move_meal_plan(
  p_plan_id uuid,
  p_target_date date,
  p_target_slot text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_source public.meal_plans;
  v_target public.meal_plans;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_target_slot not in ('breakfast', 'lunch', 'dinner', 'snack') then
    raise exception 'Invalid meal slot';
  end if;

  perform 1 from public.meal_plans
  where user_id = v_user_id
    and (id = p_plan_id or (planned_date = p_target_date and meal_slot = p_target_slot))
  order by id for update;

  select * into v_source from public.meal_plans where id = p_plan_id and user_id = v_user_id;
  if v_source.id is null then raise exception 'Meal plan not found'; end if;
  select * into v_target from public.meal_plans
    where user_id = v_user_id and planned_date = p_target_date and meal_slot = p_target_slot;

  if v_target.id is not null and v_target.id <> v_source.id then
    update public.meal_plans set meal_slot = '__moving__' || v_target.id::text where id = v_target.id;
    update public.meal_plans set planned_date = p_target_date, meal_slot = p_target_slot where id = v_source.id;
    update public.meal_plans set planned_date = v_source.planned_date, meal_slot = v_source.meal_slot where id = v_target.id;
  else
    update public.meal_plans set planned_date = p_target_date, meal_slot = p_target_slot where id = v_source.id;
  end if;
end;
$$;

create or replace function public.confirm_meal_log(
  p_estimate jsonb,
  p_inventory_item_ids uuid[] default '{}',
  p_meal_plan_id uuid default null,
  p_image_path text default null,
  p_source text default 'nutrition_scan',
  p_notes text default null,
  p_rating integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_log_id uuid;
  v_item_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then raise exception 'Invalid rating'; end if;
  if p_estimate ->> 'calories' is null
     or p_estimate ->> 'protein_g' is null
     or p_estimate ->> 'carbs_g' is null
     or p_estimate ->> 'fat_g' is null
     or p_estimate ->> 'confidence' is null
     or p_estimate #>> '{ranges,calories,low}' is null
     or p_estimate #>> '{ranges,calories,high}' is null
     or p_estimate #>> '{ranges,protein_g,low}' is null
     or p_estimate #>> '{ranges,protein_g,high}' is null
     or p_estimate #>> '{ranges,carbs_g,low}' is null
     or p_estimate #>> '{ranges,carbs_g,high}' is null
     or p_estimate #>> '{ranges,fat_g,low}' is null
     or p_estimate #>> '{ranges,fat_g,high}' is null then
    raise exception 'Incomplete nutrition estimate';
  end if;
  if (p_estimate ->> 'calories')::integer < 0
     or (p_estimate ->> 'protein_g')::numeric < 0
     or (p_estimate ->> 'carbs_g')::numeric < 0
     or (p_estimate ->> 'fat_g')::numeric < 0
     or (p_estimate ->> 'confidence')::numeric not between 0 and 1 then
    raise exception 'Invalid nutrition estimate';
  end if;
  if not (
    (p_estimate -> 'ranges' -> 'calories' ->> 'low')::integer
      <= (p_estimate ->> 'calories')::integer
    and (p_estimate ->> 'calories')::integer
      <= (p_estimate -> 'ranges' -> 'calories' ->> 'high')::integer
    and (p_estimate -> 'ranges' -> 'protein_g' ->> 'low')::numeric
      <= (p_estimate ->> 'protein_g')::numeric
    and (p_estimate ->> 'protein_g')::numeric
      <= (p_estimate -> 'ranges' -> 'protein_g' ->> 'high')::numeric
    and (p_estimate -> 'ranges' -> 'carbs_g' ->> 'low')::numeric
      <= (p_estimate ->> 'carbs_g')::numeric
    and (p_estimate ->> 'carbs_g')::numeric
      <= (p_estimate -> 'ranges' -> 'carbs_g' ->> 'high')::numeric
    and (p_estimate -> 'ranges' -> 'fat_g' ->> 'low')::numeric
      <= (p_estimate ->> 'fat_g')::numeric
    and (p_estimate ->> 'fat_g')::numeric
      <= (p_estimate -> 'ranges' -> 'fat_g' ->> 'high')::numeric
  ) then
    raise exception 'Nutrition point estimate must be inside its likely range';
  end if;
  if p_image_path is not null
     and split_part(p_image_path, '/', 1) <> v_user_id::text then
    raise exception 'Invalid meal image path';
  end if;
  if p_meal_plan_id is not null and not exists (
    select 1 from public.meal_plans where id = p_meal_plan_id and user_id = v_user_id
  ) then raise exception 'Meal plan not found'; end if;

  perform 1 from public.food_items
  where id = any(p_inventory_item_ids) and user_id = v_user_id
  order by id for update;
  if (select count(*) from public.food_items where id = any(p_inventory_item_ids) and user_id = v_user_id)
     <> cardinality(p_inventory_item_ids) then
    raise exception 'Inventory item not found';
  end if;

  insert into public.meal_log (
    user_id, title, calories, protein_g, carbs_g, fat_g,
    calorie_low, calorie_high, protein_low_g, protein_high_g,
    carbs_low_g, carbs_high_g, fat_low_g, fat_high_g,
    confidence, provenance, estimate_model, identified_ingredients,
    deducted_item_ids, meal_plan_id, image_path, image_url, source,
    notes, rating, confirmed_at, image_delete_after
  ) values (
    v_user_id,
    coalesce(nullif(p_estimate ->> 'title', ''), 'Logged meal'),
    (p_estimate ->> 'calories')::integer,
    (p_estimate ->> 'protein_g')::numeric,
    (p_estimate ->> 'carbs_g')::numeric,
    (p_estimate ->> 'fat_g')::numeric,
    (p_estimate -> 'ranges' -> 'calories' ->> 'low')::integer,
    (p_estimate -> 'ranges' -> 'calories' ->> 'high')::integer,
    (p_estimate -> 'ranges' -> 'protein_g' ->> 'low')::numeric,
    (p_estimate -> 'ranges' -> 'protein_g' ->> 'high')::numeric,
    (p_estimate -> 'ranges' -> 'carbs_g' ->> 'low')::numeric,
    (p_estimate -> 'ranges' -> 'carbs_g' ->> 'high')::numeric,
    (p_estimate -> 'ranges' -> 'fat_g' ->> 'low')::numeric,
    (p_estimate -> 'ranges' -> 'fat_g' ->> 'high')::numeric,
    (p_estimate ->> 'confidence')::numeric,
    'user_confirmed',
    p_estimate ->> 'model',
    coalesce(p_estimate -> 'ingredients', '[]'::jsonb),
    to_jsonb(p_inventory_item_ids),
    p_meal_plan_id,
    p_image_path,
    null,
    p_source,
    p_notes,
    p_rating,
    now(),
    case when p_image_path is null then null else now() + interval '90 days' end
  ) returning id into v_log_id;

  foreach v_item_id in array p_inventory_item_ids loop
    update public.food_items
    set lifecycle_state = 'consumed', version = version + 1, updated_at = now()
    where id = v_item_id;
    insert into public.inventory_events (user_id, food_item_id, event_type, metadata)
    values (v_user_id, v_item_id, 'consumed', jsonb_build_object('meal_log_id', v_log_id));
  end loop;

  if p_meal_plan_id is not null then
    update public.meal_plans set status = 'eaten' where id = p_meal_plan_id and user_id = v_user_id;
  end if;
  return v_log_id;
end;
$$;

create or replace function public.consume_ai_quota(p_user_id uuid, p_usage_kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  v_limit := case p_usage_kind when 'vision' then 20 when 'text' then 20 when 'image' then 5 else null end;
  if v_limit is null then raise exception 'Invalid usage kind'; end if;

  insert into public.ai_usage_daily (user_id, usage_date, usage_kind, request_count, updated_at)
  values (p_user_id, current_date, p_usage_kind, 1, now())
  on conflict (user_id, usage_date, usage_kind) do update
  set request_count = public.ai_usage_daily.request_count + 1,
      updated_at = now()
  where public.ai_usage_daily.request_count < v_limit
  returning request_count into v_count;

  return v_count is not null and v_count <= v_limit;
end;
$$;

revoke execute on function public.complete_onboarding(jsonb) from public, anon;
revoke execute on function public.transition_inventory_item(uuid, text, numeric, text) from public, anon;
revoke execute on function public.move_shopping_items_to_inventory(jsonb) from public, anon;
revoke execute on function public.move_meal_plan(uuid, date, text) from public, anon;
revoke execute on function public.confirm_meal_log(jsonb, uuid[], uuid, text, text, text, integer) from public, anon;
revoke execute on function public.consume_ai_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_onboarding(jsonb) to authenticated;
grant execute on function public.transition_inventory_item(uuid, text, numeric, text) to authenticated;
grant execute on function public.move_shopping_items_to_inventory(jsonb) to authenticated;
grant execute on function public.move_meal_plan(uuid, date, text) to authenticated;
grant execute on function public.confirm_meal_log(jsonb, uuid[], uuid, text, text, text, integer) to authenticated;
grant execute on function public.consume_ai_quota(uuid, text) to service_role;

-- Replace the unsafe public score RPC with an internal trigger.
drop function if exists public.recalculate_meal_scores(uuid);

create or replace function private.recalculate_meal_scores()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meal_id uuid := coalesce(new.meal_id, old.meal_id);
begin
  update public.meal_library m
  set quality_score = greatest(0,
        coalesce(m.times_cooked, 0) * 3.0
      + coalesce(m.times_planned, 0) * 2.0
      + coalesce(m.times_viewed, 0) * 0.5
      + coalesce(m.avg_rating, 0) * 2.0
      + (select count(*) * 2.0 from public.meal_feedback f
         where f.meal_id = v_meal_id and f.feedback_type in ('loved_it', 'family_liked'))
      - coalesce(m.times_skipped, 0) * 1.5
      - (select count(*) * 1.0 from public.meal_feedback f
         where f.meal_id = v_meal_id and f.feedback_type in (
           'too_complicated', 'took_too_long', 'too_many_missing', 'too_expensive',
           'too_high_calorie', 'not_filling', 'family_disliked'
         ))
      )
  where m.id = v_meal_id;
  update public.meal_library
  set promotion_score = quality_score
  where id = v_meal_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists meal_feedback_recalculate_scores on public.meal_feedback;
create trigger meal_feedback_recalculate_scores
after insert or update or delete on public.meal_feedback
for each row execute function private.recalculate_meal_scores();

-- Private meal images: user-id is always the first path segment.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-media', 'recipe-media', true, 20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload own meal photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can view own meal photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can delete own meal photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Index every foreign key / ownership path used by joins, RLS and cascades.
create index if not exists food_items_user_state_idx on public.food_items (user_id, lifecycle_state, expiry_date);
create index if not exists inventory_events_user_created_idx on public.inventory_events (user_id, created_at desc);
create index if not exists inventory_events_food_item_idx on public.inventory_events (food_item_id);
create index if not exists recipes_creator_idx on public.recipes (creator_id);
create index if not exists recipes_review_idx on public.recipes (review_status, published_at desc);
create index if not exists recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);
create index if not exists recipe_ingredients_normalized_idx on public.recipe_ingredients (normalized_name);
create index if not exists recipe_books_creator_idx on public.recipe_books (creator_id);
create index if not exists recipe_book_recipes_recipe_idx on public.recipe_book_recipes (recipe_id);
create index if not exists recipe_book_access_book_idx on public.recipe_book_access (recipe_book_id);
create index if not exists user_recipes_user_idx on public.user_recipes (user_id, updated_at desc);
create index if not exists recipe_submissions_user_idx on public.recipe_submissions (user_id, created_at desc);
create index if not exists recipe_submissions_reviewer_idx on public.recipe_submissions (reviewed_by);
create index if not exists recipe_memory_recipe_idx on public.recipe_memory (recipe_id);
create index if not exists meal_log_user_logged_idx on public.meal_log (user_id, logged_at desc);
create index if not exists meal_log_meal_plan_idx on public.meal_log (meal_plan_id);
create index if not exists meal_plans_user_date_idx on public.meal_plans (user_id, planned_date, meal_slot);
create index if not exists shopping_list_user_checked_idx on public.shopping_list (user_id, checked, created_at);
create index if not exists waste_log_user_wasted_idx on public.waste_log (user_id, wasted_at desc);
create index if not exists push_subscriptions_user_enabled_idx on public.push_subscriptions (user_id, enabled);
create index if not exists notification_preferences_due_idx
  on public.notification_preferences (expiry_reminders, notify_hour, last_expiry_sent_on);

-- The before-user-created hook must be enabled in each Supabase project's Auth
-- Hooks settings with URI: pg-functions://postgres/private/hook_require_beta_invite
