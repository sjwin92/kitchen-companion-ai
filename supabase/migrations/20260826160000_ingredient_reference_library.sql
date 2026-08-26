-- Ingredient reference library.
--
-- A shared, read-only food composition table used for nutrition estimates,
-- unit conversion (household measures to grams), allergen hints and shelf-life
-- defaults. Rows are sourced from USDA FoodData Central SR Legacy, a work of
-- the U.S. federal government released into the public domain (CC0 1.0), so it
-- can be redistributed inside the app without a licence fee or attribution
-- obligation. We still record provenance on every row.
--
-- This table is reference data, not user data: every authenticated user reads
-- the same rows, and only service_role writes. It is deliberately separate
-- from public.food_items, which holds each user's own pantry.

create table public.ingredient_reference (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  category text,
  aisle text,
  -- Composition per 100 g as eaten, keyed the same way as recipes.nutrition.
  nutrition_per_100g jsonb not null default '{}'::jsonb,
  -- Household measures with their gram weights, e.g.
  -- [{"unit":"cup","modifier":"cup, chopped","grams_per_unit":146}]
  portions jsonb not null default '[]'::jsonb,
  allergen_tags text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  -- Typical storage life in days by location; nulls mean "not applicable".
  shelf_life_fridge_days integer check (shelf_life_fridge_days >= 0),
  shelf_life_pantry_days integer check (shelf_life_pantry_days >= 0),
  shelf_life_freezer_days integer check (shelf_life_freezer_days >= 0),
  -- True for basic whole foods (single-ingredient staples), false for
  -- composite or branded products. Used to bias suggestions towards cooking
  -- from scratch.
  is_whole_food boolean not null default false,
  fdc_id integer,
  source text not null default 'usda_fdc_sr_legacy_2018_04',
  source_url text,
  rights_basis text not null default 'public_domain'
    check (rights_basis in ('original_owned', 'creator_permission', 'licensed', 'public_domain')),
  rights_notes text,
  review_status text not null default 'draft'
    check (review_status in ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  content_version integer not null default 1 check (content_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ingredient_reference_fdc_id_idx
  on public.ingredient_reference (fdc_id)
  where fdc_id is not null;
create index ingredient_reference_aisle_idx on public.ingredient_reference (aisle);
create index ingredient_reference_whole_food_idx
  on public.ingredient_reference (is_whole_food)
  where is_whole_food;
-- Trigram search over the display name so "chick" finds chickpeas and chicken.
create extension if not exists pg_trgm with schema extensions;
create index ingredient_reference_display_name_trgm_idx
  on public.ingredient_reference using gin (display_name extensions.gin_trgm_ops);

-- Aliases let cook-facing names ("beef mince", "courgette") resolve to the
-- USDA row without polluting the canonical display name.
create table public.ingredient_reference_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_reference_id uuid not null
    references public.ingredient_reference(id) on delete cascade,
  alias text not null,
  locale text not null default 'en-GB',
  created_at timestamptz not null default now(),
  unique (alias, locale)
);

create index ingredient_reference_aliases_ref_idx
  on public.ingredient_reference_aliases (ingredient_reference_id);

create or replace function public.update_ingredient_reference_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_ingredient_reference_updated_at
  before update on public.ingredient_reference
  for each row execute function public.update_ingredient_reference_updated_at();

alter table public.ingredient_reference enable row level security;
alter table public.ingredient_reference_aliases enable row level security;

create policy ingredient_reference_read_all
  on public.ingredient_reference for select to authenticated
  using (true);

create policy ingredient_reference_aliases_read_all
  on public.ingredient_reference_aliases for select to authenticated
  using (true);

grant select on public.ingredient_reference to authenticated;
grant select on public.ingredient_reference_aliases to authenticated;

grant select, insert, update, delete on
  public.ingredient_reference,
  public.ingredient_reference_aliases
  to service_role;

comment on table public.ingredient_reference is
  'Read-only food composition reference imported from USDA FoodData Central SR Legacy (public domain, CC0 1.0). Writes are service_role only.';
comment on column public.ingredient_reference.portions is
  'Household measures with gram weights, used to convert recipe quantities to metric.';
comment on column public.ingredient_reference.is_whole_food is
  'True for single-ingredient whole foods; false for composite or branded products.';
