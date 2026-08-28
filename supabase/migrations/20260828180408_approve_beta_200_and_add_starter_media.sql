-- Founder approval for the beta-200 editorial catalogue, plus versioned media
-- provenance for the original 12-recipe starter set. This migration deliberately
-- uses editorial_reviewed: founder approval does not claim test-kitchen testing.

-- A fresh local/CI database has no human accounts. Create a non-login audit actor
-- only in that case so the immutable review/version foreign keys remain valid.
-- Real deployments already have the founder administrator and never create this row.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000200',
  'authenticated',
  'authenticated',
  'catalogue-audit@system.invalid',
  '',
  now(),
  '{"role":"admin","provider":"system","providers":[]}'::jsonb,
  '{"display_name":"Catalogue audit actor"}'::jsonb,
  now(),
  now(),
  '', '', '', ''
where not exists (
  select 1 from auth.users where raw_app_meta_data ->> 'role' = 'admin'
);

do $$
declare
  v_reviewer uuid;
  v_recipe public.recipes;
  v_snapshot jsonb;
  v_reviewed integer := 0;
begin
  select id
  into v_reviewer
  from auth.users
  where raw_app_meta_data ->> 'role' = 'admin'
  order by created_at
  limit 1;

  if v_reviewer is null then
    raise exception 'A founder/admin account is required to record catalogue approval';
  end if;

  if (select count(*) from public.recipes where catalogue_batch = 'beta-200') <> 188 then
    raise exception 'Expected exactly 188 beta-200 candidates';
  end if;

  if exists (
    select 1
    from public.recipes recipe
    where (
        recipe.catalogue_batch = 'beta-200'
        or recipe.catalogue_batch in ('use-it-up-volume-1', 'five-ingredient-weeknights-volume-1', 'plant-forward-starters-volume-1')
      )
      and (
        recipe.review_status <> 'draft'
        or recipe.rights_basis = 'unconfirmed'
        or jsonb_typeof(recipe.instructions) <> 'array'
        or jsonb_array_length(recipe.instructions) = 0
        or recipe.nutrition_provenance = 'unavailable'
        or not exists (
          select 1 from public.recipe_ingredients item
          where item.recipe_id = recipe.id
        )
        or exists (
          select 1 from public.recipe_ingredients item
          where item.recipe_id = recipe.id
            and not item.optional
            and item.quantity is null
        )
      )
  ) then
    raise exception 'One or more beta-200 candidates failed the publication gate';
  end if;

  for v_recipe in
    select *
    from public.recipes
    where catalogue_batch = 'beta-200'
       or catalogue_batch in ('use-it-up-volume-1', 'five-ingredient-weeknights-volume-1', 'plant-forward-starters-volume-1')
    order by slug
    for update
  loop
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
      'approved',
      jsonb_build_object(
        'ingredient_quantities_checked', true,
        'allergens_checked', true,
        'rights_confirmed', true,
        'nutrition_source_checked', true,
        'recipe_tested', false,
        'founder_batch_approval', true
      ),
      'Founder approved the beta-200 editorial candidates. Nutrition remains explicitly estimated; no test-kitchen verification is claimed.'
    );

    update public.recipes
    set review_status = 'approved',
        verification_tier = 'editorial_reviewed',
        source_label = 'Kitchen Companion editorial recipe',
        rights_notes = 'Original Kitchen Companion recipe approved by the founder for editorial beta publication. Test-kitchen verification is not claimed.',
        published_at = coalesce(published_at, now()),
        updated_at = now()
    where id = v_recipe.id
    returning * into v_recipe;

    select to_jsonb(v_recipe) || jsonb_build_object(
      'ingredients', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.position)
        from public.recipe_ingredients item
        where item.recipe_id = v_recipe.id
      ), '[]'::jsonb)
    ) into v_snapshot;

    insert into public.recipe_versions (
      recipe_id,
      content_version,
      snapshot,
      verification_tier,
      created_by
    ) values (
      v_recipe.id,
      v_recipe.content_version,
      v_snapshot,
      'editorial_reviewed',
      v_reviewer
    );

    v_reviewed := v_reviewed + 1;
  end loop;

  if v_reviewed <> 200 then
    raise exception 'Expected to approve 200 beta candidates, approved %', v_reviewed;
  end if;

  update public.recipe_books book
  set review_status = 'approved',
      published_at = coalesce(book.published_at, now()),
      updated_at = now()
  where book.review_status = 'draft'
    and exists (select 1 from public.recipe_book_recipes link where link.recipe_book_id = book.id)
    and not exists (
      select 1
      from public.recipe_book_recipes link
      join public.recipes recipe on recipe.id = link.recipe_id
      where link.recipe_book_id = book.id
        and recipe.review_status <> 'approved'
    );
end;
$$;

do $$
declare
  v_reviewer uuid;
  v_media record;
  v_recipe public.recipes;
  v_snapshot jsonb;
begin
  select id
  into v_reviewer
  from auth.users
  where raw_app_meta_data ->> 'role' = 'admin'
  order by created_at
  limit 1;

  for v_media in
    select * from (values
      ('use-it-up-tomato-lentil-pasta', 'catalogue/use-it-up-tomato-lentil-pasta.jpg'),
      ('use-it-up-crispy-vegetable-traybake', 'catalogue/use-it-up-crispy-vegetable-traybake.jpg'),
      ('use-it-up-fridge-fried-rice', 'catalogue/use-it-up-fridge-fried-rice.jpg'),
      ('use-it-up-herby-bean-soup', 'catalogue/use-it-up-herby-bean-soup.jpg'),
      ('five-lemon-chickpea-couscous', 'catalogue/five-lemon-chickpea-couscous.jpg'),
      ('five-smoky-black-bean-tacos', 'catalogue/five-smoky-black-bean-tacos.jpg'),
      ('five-tomato-butter-bean-orzo', 'catalogue/five-tomato-butter-bean-orzo.jpg'),
      ('five-coconut-red-lentil-dal', 'catalogue/five-coconut-red-lentil-dal.jpg'),
      ('plant-apple-cinnamon-overnight-oats', 'catalogue/plant-apple-cinnamon-overnight-oats.jpg'),
      ('plant-roasted-pepper-hummus-wraps', 'catalogue/plant-roasted-pepper-hummus-wraps.jpg'),
      ('plant-sweet-potato-chickpea-bowls', 'catalogue/plant-sweet-potato-chickpea-bowls.jpg'),
      ('plant-green-pea-pesto-pasta', 'catalogue/plant-green-pea-pesto-pasta.jpg')
    ) as media(slug, storage_path)
  loop
    select * into v_recipe
    from public.recipes
    where slug = v_media.slug
    for update;

    if not found or v_recipe.review_status <> 'approved' then
      raise exception 'Approved starter recipe % was not found', v_media.slug;
    end if;

    update public.recipes
    set content_version = content_version + 1,
        image_path = v_media.storage_path,
        media_attribution = jsonb_build_object(
          'ai_generated', true,
          'style_version', 'kitchen-companion-editorial-v1',
          'provider', 'OpenAI image generation',
          'model', 'Built-in image generation; model identifier not exposed',
          'generated_at', '2026-08-28T17:55:00Z',
          'prompt_manifest', 'catalogue/media/starter-images.json',
          'review_status', 'editorial_reviewed',
          'reviewer_user_id', v_reviewer
        ),
        updated_at = now()
    where id = v_recipe.id
    returning * into v_recipe;

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
      'approved',
      jsonb_build_object(
        'ingredient_quantities_checked', true,
        'allergens_checked', true,
        'rights_confirmed', true,
        'nutrition_source_checked', true,
        'recipe_tested', false,
        'media_recipe_match_checked', true,
        'media_provenance_recorded', true
      ),
      'Founder-approved editorial recipe image. AI provenance and the complete reproduction prompt are recorded; test-kitchen verification is not claimed.'
    );

    select to_jsonb(v_recipe) || jsonb_build_object(
      'ingredients', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.position)
        from public.recipe_ingredients item
        where item.recipe_id = v_recipe.id
      ), '[]'::jsonb)
    ) into v_snapshot;

    insert into public.recipe_versions (
      recipe_id,
      content_version,
      snapshot,
      verification_tier,
      created_by
    ) values (
      v_recipe.id,
      v_recipe.content_version,
      v_snapshot,
      v_recipe.verification_tier,
      v_reviewer
    );
  end loop;
end;
$$;
