-- Publish the visually reviewed Flexitarian Classics artwork. These images are
-- recipe-specific AI-assisted editorial assets; they do not claim test-kitchen verification.

do $$
declare
  v_reviewer uuid;
  v_media record;
  v_recipe public.recipes;
  v_snapshot jsonb;
begin
  select id into v_reviewer
  from auth.users
  where raw_app_meta_data ->> 'role' = 'admin'
  order by created_at
  limit 1;

  if v_reviewer is null then
    raise exception 'A founder/admin account is required to record media approval';
  end if;

  for v_media in
    select * from (values
      ('flexitarian-classics-beef-and-lentil-tomato-pasta', 'catalogue/flexitarian-classics-beef-and-lentil-tomato-pasta.jpg'),
      ('flexitarian-classics-turkey-and-black-bean-tacos', 'catalogue/flexitarian-classics-turkey-and-black-bean-tacos.jpg'),
      ('flexitarian-classics-chicken-and-chickpea-coconut-curry', 'catalogue/flexitarian-classics-chicken-and-chickpea-coconut-curry.jpg'),
      ('flexitarian-classics-pork-and-butter-bean-tomato-stew', 'catalogue/flexitarian-classics-pork-and-butter-bean-tomato-stew.jpg'),
      ('flexitarian-classics-beef-mushroom-barley-bowls', 'catalogue/flexitarian-classics-beef-mushroom-barley-bowls.jpg'),
      ('flexitarian-classics-turkey-lentil-rice-pot', 'catalogue/flexitarian-classics-turkey-lentil-rice-pot.jpg'),
      ('flexitarian-classics-chicken-butter-bean-traybake', 'catalogue/flexitarian-classics-chicken-butter-bean-traybake.jpg'),
      ('flexitarian-classics-beef-kidney-bean-chilli-bowls', 'catalogue/flexitarian-classics-beef-kidney-bean-chilli-bowls.jpg'),
      ('flexitarian-classics-pork-apple-barley-pot', 'catalogue/flexitarian-classics-pork-apple-barley-pot.jpg'),
      ('flexitarian-classics-turkey-chickpea-couscous-bowls', 'catalogue/flexitarian-classics-turkey-chickpea-couscous-bowls.jpg'),
      ('flexitarian-classics-chicken-lentil-vegetable-soup', 'catalogue/flexitarian-classics-chicken-lentil-vegetable-soup.jpg')
    ) as media(slug, storage_path)
  loop
    select * into v_recipe from public.recipes where slug = v_media.slug for update;
    if not found or v_recipe.review_status <> 'approved' then
      raise exception 'Approved Flexitarian Classics recipe % was not found', v_media.slug;
    end if;
    if v_recipe.image_path is not null then
      raise exception 'Flexitarian Classics recipe % already has media', v_media.slug;
    end if;

    update public.recipes
    set content_version = content_version + 1,
        image_path = v_media.storage_path,
        media_attribution = jsonb_build_object(
          'ai_generated', true,
          'style_version', 'kitchen-companion-editorial-v1',
          'provider', 'OpenAI image generation',
          'model', 'Built-in image generation; model identifier not exposed',
          'generated_at', '2026-08-28T21:35:00Z',
          'prompt_manifest', 'catalogue/media/beta-200-image-queue.json',
          'review_status', 'editorial_reviewed',
          'reviewer_user_id', v_reviewer
        ),
        updated_at = now()
    where id = v_recipe.id
    returning * into v_recipe;

    insert into public.recipe_reviews (
      recipe_id, content_version, reviewer_user_id, decision, checklist, notes
    ) values (
      v_recipe.id, v_recipe.content_version, v_reviewer, 'approved',
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
      'Founder-approved editorial recipe image. Title, ingredients and visible food were cross-checked; AI provenance and prompt are recorded. Test-kitchen verification is not claimed.'
    );

    select to_jsonb(v_recipe) || jsonb_build_object(
      'ingredients', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.position)
        from public.recipe_ingredients item where item.recipe_id = v_recipe.id
      ), '[]'::jsonb)
    ) into v_snapshot;

    insert into public.recipe_versions (
      recipe_id, content_version, snapshot, verification_tier, created_by
    ) values (
      v_recipe.id, v_recipe.content_version, v_snapshot, v_recipe.verification_tier, v_reviewer
    );

    update public.meal_plans
    set title = v_recipe.title, image = v_recipe.image_path
    where plan_kind = 'catalogue' and recipe_id = v_recipe.id::text;
  end loop;

  update public.recipe_books book
  set cover_path = (
        select recipe.image_path
        from public.recipe_book_recipes link
        join public.recipes recipe on recipe.id = link.recipe_id
        where link.recipe_book_id = book.id and recipe.image_path is not null
        order by link.position, recipe.id limit 1
      ),
      content_version = content_version + 1,
      updated_at = now()
  where book.cover_path is null
    and exists (
      select 1 from public.recipe_book_recipes link
      join public.recipes recipe on recipe.id = link.recipe_id
      where link.recipe_book_id = book.id and recipe.image_path is not null
    );
end;
$$;
