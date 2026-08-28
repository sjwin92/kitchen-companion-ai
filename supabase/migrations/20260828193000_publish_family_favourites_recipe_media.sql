-- Publish the visually reviewed Family Favourites artwork. Image paths remain
-- provider-neutral storage object names; the client resolves them to public
-- URLs when rendering both catalogue recipes and previously planned meals.

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

  if v_reviewer is null then
    raise exception 'A founder/admin account is required to record media approval';
  end if;

  for v_media in
    select * from (values
      ('family-favourites-chicken-tomato-pasta-bake', 'catalogue/family-favourites-chicken-tomato-pasta-bake.jpg'),
      ('family-favourites-lentil-shepherd-s-potato-bake', 'catalogue/family-favourites-lentil-shepherd-s-potato-bake.jpg'),
      ('family-favourites-tuna-sweetcorn-pasta-bake', 'catalogue/family-favourites-tuna-sweetcorn-pasta-bake.jpg'),
      ('family-favourites-mild-chickpea-coconut-curry', 'catalogue/family-favourites-mild-chickpea-coconut-curry.jpg'),
      ('family-favourites-mild-chicken-and-pea-curry', 'catalogue/family-favourites-mild-chicken-and-pea-curry.jpg'),
      ('family-favourites-turkey-pepper-rice-pot', 'catalogue/family-favourites-turkey-pepper-rice-pot.jpg'),
      ('family-favourites-black-bean-sweetcorn-tacos', 'catalogue/family-favourites-black-bean-sweetcorn-tacos.jpg'),
      ('family-favourites-chicken-pepper-tacos', 'catalogue/family-favourites-chicken-pepper-tacos.jpg'),
      ('family-favourites-cheesy-broccoli-wholewheat-pasta', 'catalogue/family-favourites-cheesy-broccoli-wholewheat-pasta.jpg'),
      ('family-favourites-sausage-free-bean-and-potato-traybake', 'catalogue/family-favourites-sausage-free-bean-and-potato-traybake.jpg'),
      ('family-favourites-lemon-chicken-and-broccoli-traybake', 'catalogue/family-favourites-lemon-chicken-and-broccoli-traybake.jpg')
    ) as media(slug, storage_path)
  loop
    select * into v_recipe
    from public.recipes
    where slug = v_media.slug
    for update;

    if not found or v_recipe.review_status <> 'approved' then
      raise exception 'Approved Family Favourites recipe % was not found', v_media.slug;
    end if;

    if v_recipe.image_path is not null then
      raise exception 'Family Favourites recipe % already has media', v_media.slug;
    end if;

    update public.recipes
    set content_version = content_version + 1,
        image_path = v_media.storage_path,
        media_attribution = jsonb_build_object(
          'ai_generated', true,
          'style_version', 'kitchen-companion-editorial-v1',
          'provider', 'OpenAI image generation',
          'model', 'Built-in image generation; model identifier not exposed',
          'generated_at', '2026-08-28T19:28:29Z',
          'prompt_manifest', 'catalogue/media/family-favourites-images.json',
          'review_status', 'editorial_reviewed',
          'reviewer_user_id', v_reviewer
        ),
        updated_at = now()
    where id = v_recipe.id
    returning * into v_recipe;

    insert into public.recipe_reviews (
      recipe_id, content_version, reviewer_user_id, decision, checklist, notes
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
        'title_ingredient_match_checked', true,
        'media_recipe_match_checked', true,
        'media_provenance_recorded', true
      ),
      'Founder-approved editorial recipe image. Title, ingredients and visible food were cross-checked; AI provenance and exact prompts are recorded. Test-kitchen verification is not claimed.'
    );

    select to_jsonb(v_recipe) || jsonb_build_object(
      'ingredients', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.position)
        from public.recipe_ingredients item
        where item.recipe_id = v_recipe.id
      ), '[]'::jsonb)
    ) into v_snapshot;

    insert into public.recipe_versions (
      recipe_id, content_version, snapshot, verification_tier, created_by
    ) values (
      v_recipe.id,
      v_recipe.content_version,
      v_snapshot,
      v_recipe.verification_tier,
      v_reviewer
    );

    update public.meal_plans
    set title = v_recipe.title,
        image = v_recipe.image_path
    where plan_kind = 'catalogue'
      and recipe_id = v_recipe.id::text;
  end loop;

  update public.recipe_books book
  set cover_path = (
        select recipe.image_path
        from public.recipe_book_recipes link
        join public.recipes recipe on recipe.id = link.recipe_id
        where link.recipe_book_id = book.id
          and recipe.image_path is not null
        order by link.position, recipe.id
        limit 1
      ),
      content_version = content_version + 1,
      updated_at = now()
  where book.cover_path is null
    and exists (
      select 1
      from public.recipe_book_recipes link
      join public.recipes recipe on recipe.id = link.recipe_id
      where link.recipe_book_id = book.id
        and recipe.image_path is not null
    );
end;
$$;
