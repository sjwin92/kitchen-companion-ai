-- Metadata needed for a useful 200-recipe beta catalogue. These fields are
-- deliberately additive: existing published versions remain valid and new
-- candidate recipes can be imported and reviewed incrementally.

alter table public.recipes
  add column if not exists equipment_tags text[] not null default '{}'::text[],
  add column if not exists season_tags text[] not null default '{}'::text[],
  add column if not exists storage_guidance jsonb not null default '{}'::jsonb,
  add column if not exists swap_guidance jsonb not null default '[]'::jsonb,
  add column if not exists catalogue_batch text;

alter table public.recipes
  add constraint recipes_storage_guidance_object check (jsonb_typeof(storage_guidance) = 'object'),
  add constraint recipes_swap_guidance_array check (jsonb_typeof(swap_guidance) = 'array'),
  add constraint recipes_catalogue_batch_normalized check (
    catalogue_batch is null
    or catalogue_batch = lower(btrim(catalogue_batch))
  );

create index if not exists recipes_equipment_tags_idx
  on public.recipes using gin (equipment_tags);
create index if not exists recipes_season_tags_idx
  on public.recipes using gin (season_tags);
create index if not exists recipes_catalogue_batch_idx
  on public.recipes (catalogue_batch, review_status);

comment on column public.recipes.storage_guidance is
  'Editorial storage, reheating and freezing guidance. Draft data must be checked before publication.';
comment on column public.recipes.swap_guidance is
  'Structured optional substitutions. Dietary and allergen labels still describe the canonical recipe only.';
comment on column public.recipes.catalogue_batch is
  'Normalized import batch label used for coverage and editorial operations.';

-- Server-side, idempotent candidate import used by the checked-in catalogue
-- seed. It never overwrites approved recipes or books and never publishes.
create or replace function private.import_catalogue_candidate_pack(p_payload jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_creator jsonb := p_payload -> 'creator';
  v_book jsonb := p_payload -> 'book';
  v_recipe jsonb;
  v_ingredient jsonb;
  v_creator_id uuid;
  v_book_id uuid;
  v_recipe_id uuid;
  v_ingredient_id uuid;
  v_position integer;
  v_count integer := 0;
begin
  if jsonb_typeof(p_payload -> 'recipes') <> 'array'
    or jsonb_array_length(p_payload -> 'recipes') not between 8 and 15 then
    raise exception 'Candidate packs must contain between 8 and 15 recipes';
  end if;

  insert into public.creators (slug, display_name, bio, website_url, social_links, review_status)
  values (
    v_creator ->> 'slug',
    v_creator ->> 'display_name',
    nullif(v_creator ->> 'bio', ''),
    nullif(v_creator ->> 'website_url', ''),
    coalesce(v_creator -> 'social_links', '{}'::jsonb),
    'draft'
  )
  on conflict (slug) do update set
    display_name = excluded.display_name,
    bio = coalesce(excluded.bio, public.creators.bio),
    website_url = coalesce(excluded.website_url, public.creators.website_url),
    social_links = excluded.social_links,
    updated_at = now()
  returning id into v_creator_id;

  insert into public.recipe_books (
    creator_id, slug, title, subtitle, description, content_version,
    access_model, review_status, published_at
  ) values (
    v_creator_id,
    v_book ->> 'slug',
    v_book ->> 'title',
    nullif(v_book ->> 'subtitle', ''),
    nullif(v_book ->> 'description', ''),
    coalesce((v_book ->> 'content_version')::integer, 1),
    coalesce(nullif(v_book ->> 'access_model', ''), 'included'),
    'draft',
    null
  )
  on conflict (slug) do update set
    creator_id = excluded.creator_id,
    title = excluded.title,
    subtitle = excluded.subtitle,
    description = excluded.description,
    content_version = excluded.content_version,
    access_model = excluded.access_model,
    updated_at = now()
  where public.recipe_books.review_status <> 'approved'
  returning id into v_book_id;

  if v_book_id is null then
    select id into v_book_id from public.recipe_books where slug = v_book ->> 'slug';
  end if;

  if exists (select 1 from public.recipe_books where id = v_book_id and review_status = 'approved') then
    raise exception 'Approved recipe book % cannot be overwritten', v_book ->> 'slug';
  end if;

  delete from public.recipe_book_recipes where recipe_book_id = v_book_id;

  for v_recipe in select value from jsonb_array_elements(p_payload -> 'recipes') loop
    if exists (
      select 1 from public.recipes
      where slug = v_recipe ->> 'slug' and review_status = 'approved'
    ) then
      raise exception 'Approved recipe % cannot be overwritten', v_recipe ->> 'slug';
    end if;

    insert into public.recipes (
      creator_id, slug, title, description, servings, prep_minutes,
      cook_minutes, difficulty, cuisine_tags, dietary_tags, allergen_tags,
      meal_types, instructions, nutrition, estimated_cost_low_gbp,
      estimated_cost_high_gbp, price_estimate_as_of, source_type,
      content_version, review_status, published_at, source_url, rights_basis,
      rights_notes, verification_tier, source_label, media_attribution,
      dedupe_hash, nutrition_provenance, equipment_tags, season_tags,
      storage_guidance, swap_guidance, catalogue_batch
    ) values (
      v_creator_id,
      v_recipe ->> 'slug',
      v_recipe ->> 'title',
      nullif(v_recipe ->> 'description', ''),
      coalesce((v_recipe ->> 'servings')::numeric, 4),
      coalesce((v_recipe ->> 'prep_minutes')::integer, 0),
      coalesce((v_recipe ->> 'cook_minutes')::integer, 0),
      coalesce(nullif(v_recipe ->> 'difficulty', ''), 'easy'),
      array(select jsonb_array_elements_text(coalesce(v_recipe -> 'cuisine_tags', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(v_recipe -> 'dietary_tags', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(v_recipe -> 'allergen_tags', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(v_recipe -> 'meal_types', '["dinner"]'::jsonb))),
      coalesce(v_recipe -> 'instructions', '[]'::jsonb),
      coalesce(v_recipe -> 'nutrition', '{}'::jsonb),
      nullif(v_recipe ->> 'estimated_cost_low_gbp', '')::numeric,
      nullif(v_recipe ->> 'estimated_cost_high_gbp', '')::numeric,
      nullif(v_recipe ->> 'price_estimate_as_of', '')::date,
      coalesce(nullif(v_recipe ->> 'source_type', ''), 'ai_assisted'),
      coalesce((v_recipe ->> 'content_version')::integer, 1),
      'draft',
      null,
      nullif(v_recipe ->> 'source_url', ''),
      v_recipe ->> 'rights_basis',
      nullif(v_recipe ->> 'rights_notes', ''),
      null,
      nullif(v_recipe ->> 'source_label', ''),
      coalesce(v_recipe -> 'media_attribution', '{}'::jsonb),
      nullif(v_recipe ->> 'dedupe_hash', ''),
      coalesce(nullif(v_recipe ->> 'nutrition_provenance', ''), 'unavailable'),
      array(select jsonb_array_elements_text(coalesce(v_recipe -> 'equipment_tags', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(v_recipe -> 'season_tags', '[]'::jsonb))),
      coalesce(v_recipe -> 'storage_guidance', '{}'::jsonb),
      coalesce(v_recipe -> 'swap_guidance', '[]'::jsonb),
      nullif(v_recipe ->> 'catalogue_batch', '')
    )
    on conflict (slug) do update set
      creator_id = excluded.creator_id,
      title = excluded.title,
      description = excluded.description,
      servings = excluded.servings,
      prep_minutes = excluded.prep_minutes,
      cook_minutes = excluded.cook_minutes,
      difficulty = excluded.difficulty,
      cuisine_tags = excluded.cuisine_tags,
      dietary_tags = excluded.dietary_tags,
      allergen_tags = excluded.allergen_tags,
      meal_types = excluded.meal_types,
      instructions = excluded.instructions,
      nutrition = excluded.nutrition,
      estimated_cost_low_gbp = excluded.estimated_cost_low_gbp,
      estimated_cost_high_gbp = excluded.estimated_cost_high_gbp,
      price_estimate_as_of = excluded.price_estimate_as_of,
      source_type = excluded.source_type,
      content_version = excluded.content_version,
      review_status = 'draft',
      published_at = null,
      source_url = excluded.source_url,
      rights_basis = excluded.rights_basis,
      rights_notes = excluded.rights_notes,
      verification_tier = null,
      source_label = excluded.source_label,
      media_attribution = excluded.media_attribution,
      dedupe_hash = excluded.dedupe_hash,
      nutrition_provenance = excluded.nutrition_provenance,
      equipment_tags = excluded.equipment_tags,
      season_tags = excluded.season_tags,
      storage_guidance = excluded.storage_guidance,
      swap_guidance = excluded.swap_guidance,
      catalogue_batch = excluded.catalogue_batch,
      updated_at = now()
    where public.recipes.review_status <> 'approved'
    returning id into v_recipe_id;

    if v_recipe_id is null then
      raise exception 'Candidate recipe % was not writable', v_recipe ->> 'slug';
    end if;

    delete from public.recipe_ingredients where recipe_id = v_recipe_id;
    v_position := 0;
    for v_ingredient in select value from jsonb_array_elements(v_recipe -> 'ingredients') loop
      insert into public.ingredients (canonical_name, display_name, default_aisle)
      values (
        lower(btrim(v_ingredient ->> 'normalized_name')),
        v_ingredient ->> 'name',
        nullif(v_ingredient ->> 'aisle', '')
      )
      on conflict (canonical_name) do update set
        display_name = excluded.display_name,
        default_aisle = coalesce(public.ingredients.default_aisle, excluded.default_aisle),
        updated_at = now()
      returning id into v_ingredient_id;

      insert into public.ingredient_aliases (alias, ingredient_id)
      values (lower(btrim(v_ingredient ->> 'name')), v_ingredient_id)
      on conflict (alias) do nothing;

      insert into public.recipe_ingredients (
        recipe_id, position, name, normalized_name, quantity, unit,
        preparation, optional, aisle, ingredient_id
      ) values (
        v_recipe_id,
        v_position,
        v_ingredient ->> 'name',
        v_ingredient ->> 'normalized_name',
        nullif(v_ingredient ->> 'quantity', '')::numeric,
        nullif(v_ingredient ->> 'unit', ''),
        nullif(v_ingredient ->> 'preparation', ''),
        coalesce((v_ingredient ->> 'optional')::boolean, false),
        nullif(v_ingredient ->> 'aisle', ''),
        v_ingredient_id
      );
      v_position := v_position + 1;
    end loop;

    insert into public.recipe_book_recipes (recipe_book_id, recipe_id, position)
    values (v_book_id, v_recipe_id, coalesce((v_recipe ->> 'position')::integer, v_count));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function private.import_catalogue_candidate_pack(jsonb) from public, anon, authenticated;
grant execute on function private.import_catalogue_candidate_pack(jsonb) to service_role;

comment on function private.import_catalogue_candidate_pack(jsonb) is
  'Idempotently imports one 8–15 recipe candidate pack as private drafts. Approved content is never overwritten.';

-- The founder already reviewed the original 12-recipe starter catalogue.
-- Publish its three shelves only when every linked recipe is approved.
update public.creators
set review_status = 'approved', updated_at = now()
where slug = 'kitchen-companion-test-kitchen'
  and exists (
    select 1 from public.recipes
    where creator_id = public.creators.id and review_status = 'approved'
  );

update public.recipe_books b
set review_status = 'approved',
    published_at = coalesce(published_at, now()),
    updated_at = now()
where b.slug in (
  'plant-forward-starters-volume-1',
  'five-ingredient-weeknights-volume-1',
  'use-it-up-volume-1'
)
and exists (
  select 1 from public.recipe_book_recipes link
  where link.recipe_book_id = b.id
)
and not exists (
  select 1
  from public.recipe_book_recipes link
  join public.recipes recipe on recipe.id = link.recipe_id
  where link.recipe_book_id = b.id and recipe.review_status <> 'approved'
);
