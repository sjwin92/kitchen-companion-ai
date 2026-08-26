-- Phase 2: database-first catalogue growth, transparent provenance and
-- provider-independent AI spend controls.

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  display_name text not null,
  default_aisle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredients_canonical_name_normalized check (
    canonical_name = lower(btrim(canonical_name)) and canonical_name <> ''
  )
);

create table public.ingredient_aliases (
  alias text primary key,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint ingredient_alias_normalized check (alias = lower(btrim(alias)) and alias <> '')
);

insert into public.ingredients (canonical_name, display_name, default_aisle)
select distinct on (lower(btrim(normalized_name)))
  lower(btrim(normalized_name)),
  min(name),
  min(aisle)
from public.recipe_ingredients
where nullif(btrim(normalized_name), '') is not null
group by lower(btrim(normalized_name));

insert into public.ingredient_aliases (alias, ingredient_id)
select distinct lower(btrim(ri.name)), i.id
from public.recipe_ingredients ri
join public.ingredients i on i.canonical_name = lower(btrim(ri.normalized_name))
where nullif(btrim(ri.name), '') is not null
on conflict (alias) do nothing;

alter table public.recipe_ingredients
  add column ingredient_id uuid references public.ingredients(id) on delete restrict;

update public.recipe_ingredients ri
set ingredient_id = i.id
from public.ingredients i
where i.canonical_name = lower(btrim(ri.normalized_name));

create index recipe_ingredients_ingredient_idx on public.recipe_ingredients (ingredient_id, recipe_id);
create index ingredient_aliases_ingredient_idx on public.ingredient_aliases (ingredient_id);

alter table public.recipes
  add column verification_tier text not null default 'editorial_reviewed'
    check (verification_tier in ('editorial_reviewed', 'creator_verified', 'test_kitchen_verified')),
  add column source_label text,
  add column media_attribution jsonb not null default '{}'::jsonb,
  add column contributor_user_id uuid references auth.users(id) on delete set null,
  add column dedupe_hash text,
  add column nutrition_provenance text not null default 'unavailable'
    check (nutrition_provenance in ('unavailable', 'estimated', 'creator_supplied', 'calculated', 'verified'));

alter table public.recipes drop constraint recipes_rights_basis_check;
alter table public.recipes add constraint recipes_rights_basis_check
  check (rights_basis in ('unconfirmed', 'original_owned', 'creator_permission', 'user_permission', 'licensed', 'public_domain'));

update public.recipes
set source_label = case source_type
  when 'creator' then 'Creator recipe'
  when 'user_submission' then 'Community contribution'
  when 'ai_assisted' then 'AI-assisted draft'
  else 'Kitchen Companion'
end
where source_label is null;

create unique index recipes_dedupe_hash_idx
  on public.recipes (dedupe_hash)
  where dedupe_hash is not null and review_status <> 'archived';
create index recipes_public_discovery_idx
  on public.recipes (review_status, published_at desc, id);
create index recipes_dietary_tags_idx on public.recipes using gin (dietary_tags);
create index recipes_allergen_tags_idx on public.recipes using gin (allergen_tags);
create index recipes_cuisine_tags_idx on public.recipes using gin (cuisine_tags);

create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  content_version integer not null check (content_version > 0),
  snapshot jsonb not null,
  verification_tier text not null
    check (verification_tier in ('editorial_reviewed', 'creator_verified', 'test_kitchen_verified')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (recipe_id, content_version)
);

create function private.prevent_recipe_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Published recipe versions are immutable';
end;
$$;

create trigger recipe_versions_immutable
before update or delete on public.recipe_versions
for each row execute function private.prevent_recipe_version_mutation();

create table public.creator_partnerships (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creators(id) on delete cascade,
  status text not null default 'prospect'
    check (status in ('prospect', 'approved_for_outreach', 'contacted', 'interested', 'agreed', 'declined', 'paused')),
  public_contact_route text,
  founder_approved_at timestamptz,
  permission_confirmed_at timestamptz,
  agreement_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_contact_requires_approval check (
    status not in ('contacted', 'interested', 'agreed') or founder_approved_at is not null
  ),
  constraint creator_agreement_requires_permission check (
    status <> 'agreed' or (permission_confirmed_at is not null and agreement_reference is not null)
  )
);

insert into public.creator_partnerships (creator_id, status)
select id, 'prospect' from public.creators
on conflict (creator_id) do nothing;

alter table public.recipe_submissions
  add column rights_confirmed boolean not null default false,
  add column licence_grant text,
  add column duplicate_of_recipe_id uuid references public.recipes(id) on delete set null,
  add column promoted_recipe_id uuid references public.recipes(id) on delete set null;

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (capability in (
    'inventory_vision', 'receipt_extraction', 'expiry_extraction',
    'nutrition_estimate', 'private_recipe_draft', 'catalogue_enrichment'
  )),
  provider text not null check (provider in ('gemini', 'openai', 'deepseek')),
  model text not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'succeeded', 'failed', 'rejected')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_gbp numeric(12,6) not null default 0 check (estimated_cost_gbp >= 0),
  actual_cost_gbp numeric(12,6) check (actual_cost_gbp is null or actual_cost_gbp >= 0),
  provider_request_id text,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index ai_usage_events_month_idx on public.ai_usage_events (created_at, status, capability);
create index ai_usage_events_user_idx on public.ai_usage_events (user_id, created_at desc);

alter table public.ingredients enable row level security;
alter table public.ingredient_aliases enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.creator_partnerships enable row level security;
alter table public.ai_usage_events enable row level security;

create policy ingredients_authenticated_read on public.ingredients for select to authenticated using (true);
create policy ingredient_aliases_authenticated_read on public.ingredient_aliases for select to authenticated using (true);
create policy recipe_versions_approved_read on public.recipe_versions for select to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and (r.review_status = 'approved' or (select private.is_admin()))
  ));
create policy creator_partnerships_admin_all on public.creator_partnerships for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy ai_usage_events_own_or_admin_read on public.ai_usage_events for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

grant select on public.ingredients, public.ingredient_aliases, public.recipe_versions to authenticated;
grant select on public.creator_partnerships, public.ai_usage_events to authenticated;
grant select, insert, update, delete on public.ingredients, public.ingredient_aliases,
  public.recipe_versions, public.creator_partnerships, public.ai_usage_events to service_role;

create or replace function public.reserve_ai_budget(
  p_user_id uuid,
  p_capability text,
  p_provider text,
  p_model text,
  p_estimated_cost_gbp numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_month_start timestamptz := date_trunc('month', now());
  v_total numeric := 0;
  v_bucket numeric := 0;
  v_is_vision boolean := p_capability in ('inventory_vision', 'receipt_extraction', 'expiry_extraction', 'nutrition_estimate');
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_estimated_cost_gbp is null or p_estimated_cost_gbp < 0 or p_estimated_cost_gbp > 1 then
    raise exception 'Invalid estimated AI cost';
  end if;

  perform pg_advisory_xact_lock(hashtext(to_char(v_month_start, 'YYYY-MM')));

  select coalesce(sum(coalesce(actual_cost_gbp, estimated_cost_gbp)), 0)
  into v_total
  from public.ai_usage_events
  where created_at >= v_month_start and status in ('reserved', 'succeeded');

  select coalesce(sum(coalesce(actual_cost_gbp, estimated_cost_gbp)), 0)
  into v_bucket
  from public.ai_usage_events
  where created_at >= v_month_start
    and status in ('reserved', 'succeeded')
    and case when v_is_vision
      then capability in ('inventory_vision', 'receipt_extraction', 'expiry_extraction', 'nutrition_estimate')
      else capability in ('private_recipe_draft', 'catalogue_enrichment')
    end;

  if v_total + p_estimated_cost_gbp > 10 then
    raise exception 'Monthly AI budget reached';
  end if;
  if p_capability = 'private_recipe_draft' and v_total + p_estimated_cost_gbp > 9 then
    raise exception 'Private recipe drafting is paused near the monthly AI budget';
  end if;
  if v_is_vision and v_bucket + p_estimated_cost_gbp > 8 then
    raise exception 'Monthly vision allowance reached';
  end if;
  if not v_is_vision and v_bucket + p_estimated_cost_gbp > 2 then
    raise exception 'Monthly text allowance reached';
  end if;

  insert into public.ai_usage_events (
    user_id, capability, provider, model, status, estimated_cost_gbp
  ) values (
    p_user_id, p_capability, p_provider, p_model, 'reserved', p_estimated_cost_gbp
  ) returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.complete_ai_usage(
  p_event_id uuid,
  p_status text,
  p_input_tokens integer default 0,
  p_output_tokens integer default 0,
  p_actual_cost_gbp numeric default null,
  p_provider_request_id text default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_status not in ('succeeded', 'failed') then
    raise exception 'Invalid AI usage status';
  end if;
  update public.ai_usage_events
  set status = p_status,
      input_tokens = greatest(coalesce(p_input_tokens, 0), 0),
      output_tokens = greatest(coalesce(p_output_tokens, 0), 0),
      actual_cost_gbp = case when p_status = 'failed' then coalesce(p_actual_cost_gbp, 0) else p_actual_cost_gbp end,
      provider_request_id = nullif(p_provider_request_id, ''),
      error_code = nullif(p_error_code, ''),
      completed_at = now()
  where id = p_event_id and status = 'reserved';
  if not found then raise exception 'AI usage reservation not found'; end if;
end;
$$;

create or replace function public.get_ai_budget_status()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with usage as (
    select
      coalesce(sum(coalesce(actual_cost_gbp, estimated_cost_gbp)), 0) as total,
      coalesce(sum(coalesce(actual_cost_gbp, estimated_cost_gbp)) filter (
        where capability in ('inventory_vision', 'receipt_extraction', 'expiry_extraction', 'nutrition_estimate')
      ), 0) as vision,
      coalesce(sum(coalesce(actual_cost_gbp, estimated_cost_gbp)) filter (
        where capability in ('private_recipe_draft', 'catalogue_enrichment')
      ), 0) as text
    from public.ai_usage_events
    where created_at >= date_trunc('month', now())
      and status in ('reserved', 'succeeded')
      and (user_id = auth.uid() or private.is_admin())
  )
  select jsonb_build_object(
    'total_gbp', total,
    'vision_gbp', vision,
    'text_gbp', text,
    'hard_limit_gbp', 10,
    'private_drafts_available', total < 9,
    'paid_ai_available', total < 10
  ) from usage
$$;

revoke all on function public.reserve_ai_budget(uuid, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.complete_ai_usage(uuid, text, integer, integer, numeric, text, text) from public, anon, authenticated;
grant execute on function public.reserve_ai_budget(uuid, text, text, text, numeric) to service_role;
grant execute on function public.complete_ai_usage(uuid, text, integer, integer, numeric, text, text) to service_role;
revoke all on function public.get_ai_budget_status() from public, anon;
grant execute on function public.get_ai_budget_status() to authenticated;

create or replace function public.recommend_catalogue_recipes(
  p_limit integer default 30,
  p_offset integer default 0,
  p_search text default null,
  p_min_match integer default 0
)
returns table (
  recipe_id uuid,
  score numeric,
  components jsonb,
  reasons text[],
  matched_ingredient_ids uuid[],
  missing_ingredient_ids uuid[],
  matched_count integer,
  missing_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with profile as (
    select
      coalesce(dietary_preferences, '{}') as diets,
      coalesce(allergies, '{}') as allergies,
      coalesce(disliked_ingredients, '{}') as dislikes,
      coalesce(preferred_cuisines, '{}') as cuisines,
      greatest(coalesce(max_prep_time, 60), 1) as max_minutes,
      greatest(coalesce(daily_calorie_goal, 2000), 1) / 3.0 as meal_calories,
      coalesce(budget_sensitivity, 'medium') as budget_sensitivity
    from public.profiles where id = auth.uid()
  ), candidates as (
    select r.*
    from public.recipes r, profile p
    where r.review_status = 'approved'
      and not (r.allergen_tags && p.allergies)
      and (not ('vegan' = any(p.diets)) or 'vegan' = any(r.dietary_tags))
      and (not ('vegetarian' = any(p.diets)) or r.dietary_tags && array['vegetarian', 'vegan']::text[])
      and not exists (
        select 1 from public.recipe_ingredients ri, unnest(p.dislikes) dislike
        where ri.recipe_id = r.id
          and lower(ri.name) like '%' || lower(dislike) || '%'
      )
      and (
        nullif(btrim(p_search), '') is null
        or r.title ilike '%' || btrim(p_search) || '%'
        or exists (select 1 from unnest(r.cuisine_tags) tag where tag ilike '%' || btrim(p_search) || '%')
        or exists (select 1 from public.recipe_ingredients ri where ri.recipe_id = r.id and ri.name ilike '%' || btrim(p_search) || '%')
      )
  ), ingredient_fit as (
    select
      r.id,
      count(ri.id) filter (where not ri.optional)::integer as required_count,
      count(ri.id) filter (where not ri.optional and inv.food_id is not null)::integer as matched_count,
      count(ri.id) filter (where not ri.optional and inv.food_id is null)::integer as missing_count,
      coalesce(array_agg(ri.id) filter (where not ri.optional and inv.food_id is not null), '{}')::uuid[] as matched_ids,
      coalesce(array_agg(ri.id) filter (where not ri.optional and inv.food_id is null), '{}')::uuid[] as missing_ids,
      count(ri.id) filter (where not ri.optional and inv.freshness_state in ('use_today', 'use_soon'))::integer as rescue_count
    from candidates r
    left join public.recipe_ingredients ri on ri.recipe_id = r.id
    left join lateral (
      select fi.id as food_id, fi.freshness_state
      from public.current_inventory fi
      left join public.ingredient_aliases ia on ia.alias = lower(btrim(fi.name))
      where fi.user_id = auth.uid()
        and (
          ia.ingredient_id = ri.ingredient_id
          or lower(btrim(fi.name)) = lower(btrim(ri.normalized_name))
          or lower(fi.name) like '%' || lower(ri.normalized_name) || '%'
          or lower(ri.normalized_name) like '%' || lower(fi.name) || '%'
        )
      limit 1
    ) inv on true
    group by r.id
  ), scored as (
    select
      r,
      f.*,
      case when f.required_count = 0 then 1 else f.matched_count::numeric / f.required_count end as pantry_ratio,
      case when f.matched_count = 0 then 0 else f.rescue_count::numeric / f.matched_count end as rescue_ratio,
      case when exists (
        select 1 from unnest(r.cuisine_tags) tag, unnest(p.cuisines) preferred
        where lower(tag) = lower(preferred)
      ) then 1 else 0.5 end as cuisine_fit,
      greatest(0, least(1, 1 - greatest((r.prep_minutes + r.cook_minutes) - p.max_minutes, 0)::numeric / p.max_minutes)) as prep_fit,
      case
        when r.estimated_cost_high_gbp is null then 0.6
        when p.budget_sensitivity = 'high' then greatest(0, least(1, 1 - r.estimated_cost_high_gbp / 20))
        when p.budget_sensitivity = 'medium' then greatest(0, least(1, 1 - r.estimated_cost_high_gbp / 35))
        else 1
      end as budget_fit,
      case
        when coalesce((r.nutrition ->> 'calories')::numeric, 0) <= 0 then 0.6
        else greatest(0, least(1, 1 - abs((r.nutrition ->> 'calories')::numeric - p.meal_calories) / p.meal_calories))
      end as nutrition_fit,
      case when rm.last_cooked_at > now() - interval '14 days' then 0
        else greatest(0, least(1, 1 - coalesce(rm.times_cooked, 0)::numeric / 12)) end as variety_fit
    from candidates r
    join ingredient_fit f on f.id = r.id
    cross join profile p
    left join public.recipe_memory rm on rm.recipe_id = r.id and rm.user_id = auth.uid()
  ), final as (
    select *,
      pantry_ratio * 30 + rescue_ratio * 25 + cuisine_fit * 15 + prep_fit * 10
      + budget_fit * 10 + variety_fit * 5 + nutrition_fit * 5 as total_score
    from scored
    where round(pantry_ratio * 100) >= greatest(0, least(100, p_min_match))
  )
  select
    r.id,
    round(total_score, 3),
    jsonb_build_object(
      'pantry', round(pantry_ratio * 30, 3),
      'expiryRescue', round(rescue_ratio * 25, 3),
      'taste', round(cuisine_fit * 15, 3),
      'prep', round(prep_fit * 10, 3),
      'budget', round(budget_fit * 10, 3),
      'variety', round(variety_fit * 5, 3),
      'nutrition', round(nutrition_fit * 5, 3)
    ),
    array_remove(array[
      case when rescue_count > 0 then 'Uses food that needs using soon' end,
      case when pantry_ratio >= 0.75 then 'Mostly uses what you already have' end,
      case when cuisine_fit = 1 then 'Matches your preferred cuisines' end,
      case when prep_fit = 1 then 'Fits your cooking-time limit' end
    ], null),
    matched_ids,
    missing_ids,
    matched_count,
    missing_count
  from final r
  order by total_score desc, id
  limit greatest(1, least(coalesce(p_limit, 30), 100))
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.recommend_catalogue_recipes(integer, integer, text, integer) from public, anon;
grant execute on function public.recommend_catalogue_recipes(integer, integer, text, integer) to authenticated;

create or replace function public.promote_recipe_submission(
  p_submission_id uuid,
  p_slug text,
  p_reviewer_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.recipe_submissions;
  v_user_recipe public.user_recipes;
  v_recipe_id uuid;
  v_ingredient jsonb;
  v_position integer := 0;
  v_name text;
  v_normalized text;
  v_ingredient_id uuid;
  v_duplicate_id uuid;
begin
  if not private.is_admin() then raise exception 'Administrator access required'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Invalid recipe slug'; end if;

  select * into v_submission from public.recipe_submissions where id = p_submission_id for update;
  if not found then raise exception 'Recipe submission not found'; end if;
  if not v_submission.rights_confirmed or nullif(btrim(v_submission.licence_grant), '') is null then
    raise exception 'Publishing permission is required';
  end if;
  if v_submission.promoted_recipe_id is not null then return v_submission.promoted_recipe_id; end if;

  select * into v_user_recipe from public.user_recipes where id = v_submission.user_recipe_id and user_id = v_submission.user_id;
  if not found then raise exception 'Private recipe not found'; end if;

  select id into v_duplicate_id
  from public.recipes
  where review_status <> 'archived'
    and lower(btrim(title)) = lower(btrim(v_user_recipe.title))
  order by case when review_status = 'approved' then 0 else 1 end, created_at
  limit 1;
  if v_duplicate_id is not null then
    update public.recipe_submissions
    set status = 'in_review', duplicate_of_recipe_id = v_duplicate_id,
        reviewer_notes = coalesce(nullif(btrim(p_reviewer_notes), ''), reviewer_notes),
        reviewed_by = auth.uid(), reviewed_at = now()
    where id = v_submission.id;
    return v_duplicate_id;
  end if;

  insert into public.recipes (
    slug, title, description, image_path, youtube_url, servings, instructions, nutrition,
    source_type, source_label, contributor_user_id, rights_basis, rights_notes,
    nutrition_provenance, review_status, published_at
  ) values (
    p_slug, v_user_recipe.title, v_user_recipe.description, v_user_recipe.image_path,
    v_user_recipe.youtube_url, v_user_recipe.servings, v_user_recipe.instructions,
    v_user_recipe.nutrition, 'user_submission', 'Community contribution', v_submission.user_id,
    'user_permission', 'Non-exclusive publication permission recorded on submission ' || v_submission.id,
    case when v_user_recipe.nutrition = '{}'::jsonb then 'unavailable' else 'estimated' end,
    'draft', null
  ) returning id into v_recipe_id;

  for v_ingredient in select value from jsonb_array_elements(v_user_recipe.ingredients)
  loop
    v_name := case
      when jsonb_typeof(v_ingredient) = 'string' then nullif(btrim(v_ingredient #>> '{}'), '')
      else nullif(btrim(v_ingredient ->> 'name'), '')
    end;
    if v_name is null then continue; end if;
    v_normalized := lower(regexp_replace(v_name, '[^a-z0-9 ]', '', 'g'));
    if v_normalized = '' then continue; end if;
    insert into public.ingredients (canonical_name, display_name)
    values (v_normalized, v_name)
    on conflict (canonical_name) do update set updated_at = now()
    returning id into v_ingredient_id;
    insert into public.ingredient_aliases (alias, ingredient_id)
    values (lower(v_name), v_ingredient_id) on conflict (alias) do nothing;
    insert into public.recipe_ingredients (
      recipe_id, position, ingredient_id, name, normalized_name, quantity, unit, optional
    ) values (
      v_recipe_id, v_position, v_ingredient_id, v_name, v_normalized,
      case when coalesce(v_ingredient ->> 'quantity', '') ~ '^\d+(\.\d+)?$'
        then (v_ingredient ->> 'quantity')::numeric else null end,
      nullif(v_ingredient ->> 'unit', ''),
      coalesce((v_ingredient ->> 'optional')::boolean, false)
    );
    v_position := v_position + 1;
  end loop;

  update public.recipe_submissions
  set status = 'in_review', promoted_recipe_id = v_recipe_id,
      reviewer_notes = coalesce(nullif(btrim(p_reviewer_notes), ''), reviewer_notes),
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = v_submission.id;

  return v_recipe_id;
end;
$$;

revoke all on function public.promote_recipe_submission(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.promote_recipe_submission(uuid, text, text) to authenticated, service_role;

drop function public.review_catalogue_recipe(uuid, text, jsonb, text);
create function public.review_catalogue_recipe(
  p_recipe_id uuid,
  p_decision text,
  p_checklist jsonb,
  p_notes text default null,
  p_verification_tier text default 'editorial_reviewed'
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
  v_snapshot jsonb;
begin
  if not private.is_admin() then raise exception 'Administrator access required'; end if;
  if p_decision not in ('approved', 'changes_requested', 'rejected') then raise exception 'Unsupported review decision'; end if;
  if p_verification_tier not in ('editorial_reviewed', 'creator_verified', 'test_kitchen_verified') then
    raise exception 'Unsupported verification tier';
  end if;

  select * into v_recipe from public.recipes where id = p_recipe_id for update;
  if not found then raise exception 'Recipe not found'; end if;

  if p_decision = 'approved' then
    if v_recipe.rights_basis = 'unconfirmed' then raise exception 'Recipe rights must be confirmed before approval'; end if;
    if jsonb_typeof(v_recipe.instructions) <> 'array' or jsonb_array_length(v_recipe.instructions) = 0 then
      raise exception 'Recipe instructions must be complete before approval';
    end if;
    if not exists (select 1 from public.recipe_ingredients ri where ri.recipe_id = v_recipe.id) then
      raise exception 'Recipe requires at least one ingredient before approval';
    end if;
    if exists (
      select 1 from public.recipe_ingredients ri
      where ri.recipe_id = v_recipe.id and not ri.optional and ri.quantity is null
    ) then
      raise exception 'Required ingredient quantities must be complete before approval';
    end if;
    foreach v_required_check in array array[
      'ingredient_quantities_checked', 'allergens_checked', 'rights_confirmed', 'nutrition_source_checked'
    ] loop
      if coalesce((p_checklist ->> v_required_check)::boolean, false) is not true then
        raise exception 'Approval checklist is incomplete: %', v_required_check;
      end if;
    end loop;
    if p_verification_tier = 'creator_verified'
      and coalesce((p_checklist ->> 'creator_attested')::boolean, false) is not true then
      raise exception 'Creator verification evidence is required';
    end if;
    if p_verification_tier = 'creator_verified'
      and (v_recipe.source_type <> 'creator' or v_recipe.creator_id is null or v_recipe.rights_basis <> 'creator_permission') then
      raise exception 'Creator verification requires a permissioned creator recipe';
    end if;
    if p_verification_tier = 'test_kitchen_verified'
      and coalesce((p_checklist ->> 'recipe_tested')::boolean, false) is not true then
      raise exception 'Test-kitchen verification evidence is required';
    end if;
  end if;

  insert into public.recipe_reviews (recipe_id, content_version, reviewer_user_id, decision, checklist, notes)
  values (v_recipe.id, v_recipe.content_version, v_reviewer, p_decision, coalesce(p_checklist, '{}'::jsonb), nullif(btrim(p_notes), ''));

  update public.recipes
  set review_status = case p_decision when 'approved' then 'approved' when 'changes_requested' then 'in_review' else 'rejected' end,
      verification_tier = case when p_decision = 'approved' then p_verification_tier else verification_tier end,
      published_at = case when p_decision = 'approved' then coalesce(published_at, now()) else null end,
      updated_at = now()
  where id = v_recipe.id returning * into v_recipe;

  if p_decision = 'approved' then
    select to_jsonb(v_recipe) || jsonb_build_object(
      'ingredients', coalesce(jsonb_agg(to_jsonb(ri) order by ri.position), '[]'::jsonb)
    ) into v_snapshot
    from public.recipe_ingredients ri where ri.recipe_id = v_recipe.id;
    insert into public.recipe_versions (recipe_id, content_version, snapshot, verification_tier, created_by)
    values (v_recipe.id, v_recipe.content_version, v_snapshot, p_verification_tier, v_reviewer)
    on conflict (recipe_id, content_version) do nothing;
  end if;
  return v_recipe;
end;
$$;

revoke all on function public.review_catalogue_recipe(uuid, text, jsonb, text, text) from public, anon, authenticated, service_role;
grant execute on function public.review_catalogue_recipe(uuid, text, jsonb, text, text) to authenticated, service_role;

comment on table public.ingredients is 'Canonical catalogue ingredients; MyPlate is research-only and is not imported.';
comment on table public.ai_usage_events is 'Server-written provider-neutral AI cost ledger; clients can only read their own rows.';
comment on function public.recommend_catalogue_recipes(integer, integer, text, integer) is
  'Authenticated database-first catalogue ranking. The caller identity always comes from auth.uid().';
