-- Editorial audit trail for the reviewed, database-first recipe catalogue.
-- The app reads approved recipes; this workflow records the human decision
-- and the content/rights checks behind that approval.

alter table public.recipes
  add column source_url text,
  add column rights_basis text not null default 'unconfirmed'
    check (rights_basis in ('unconfirmed', 'original_owned', 'creator_permission', 'licensed', 'public_domain')),
  add column rights_notes text;

create table public.recipe_reviews (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  content_version integer not null check (content_version > 0),
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  reviewed_at timestamptz not null default now()
);

create index recipe_reviews_recipe_version_idx
  on public.recipe_reviews (recipe_id, content_version, reviewed_at desc);

alter table public.recipe_reviews enable row level security;

create policy recipe_reviews_admin_read on public.recipe_reviews
  for select to authenticated
  using ((select private.is_admin()));

revoke all on table public.recipe_reviews from public, anon, authenticated, service_role;
grant select on table public.recipe_reviews to authenticated;
grant select, insert, update, delete on table public.recipe_reviews to service_role;

create or replace function public.review_catalogue_recipe(
  p_recipe_id uuid,
  p_decision text,
  p_checklist jsonb,
  p_notes text default null
)
returns public.recipes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipe public.recipes;
  v_reviewer uuid := auth.uid();
  v_required_check text;
begin
  if not private.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if p_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Unsupported review decision';
  end if;

  select * into v_recipe
  from public.recipes
  where id = p_recipe_id
  for update;

  if not found then
    raise exception 'Recipe not found';
  end if;

  if p_decision = 'approved' then
    if v_recipe.rights_basis = 'unconfirmed' then
      raise exception 'Recipe rights must be confirmed before approval';
    end if;
    foreach v_required_check in array array[
      'recipe_tested',
      'ingredient_quantities_checked',
      'allergens_checked',
      'rights_confirmed',
      'nutrition_source_checked'
    ] loop
      if coalesce((p_checklist ->> v_required_check)::boolean, false) is not true then
        raise exception 'Approval checklist is incomplete: %', v_required_check;
      end if;
    end loop;
  end if;

  insert into public.recipe_reviews (
    recipe_id,
    content_version,
    reviewer_user_id,
    decision,
    checklist,
    notes
  ) values (
    v_recipe.id,
    v_recipe.content_version,
    v_reviewer,
    p_decision,
    coalesce(p_checklist, '{}'::jsonb),
    nullif(btrim(p_notes), '')
  );

  update public.recipes
  set review_status = case p_decision
      when 'approved' then 'approved'
      when 'changes_requested' then 'in_review'
      else 'rejected'
    end,
    published_at = case
      when p_decision = 'approved' then coalesce(published_at, now())
      else null
    end,
    updated_at = now()
  where id = v_recipe.id
  returning * into v_recipe;

  return v_recipe;
end;
$$;

revoke all on function public.review_catalogue_recipe(uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.review_catalogue_recipe(uuid, text, jsonb, text)
  to authenticated, service_role;
