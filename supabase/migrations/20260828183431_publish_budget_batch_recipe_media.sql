-- Publish founder-reviewed, recipe-specific artwork for the Budget Batch
-- Cooking collection. Every image is tied to an immutable recipe version and
-- carries enough provenance to reproduce and audit the generation workflow.

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
      ('budget-batch-cooking-smoky-three-bean-tomato-stew', 'catalogue/budget-batch-cooking-smoky-three-bean-tomato-stew.jpg'),
      ('budget-batch-cooking-red-lentil-carrot-dal', 'catalogue/budget-batch-cooking-red-lentil-carrot-dal.jpg'),
      ('budget-batch-cooking-butter-bean-and-squash-stew', 'catalogue/budget-batch-cooking-butter-bean-and-squash-stew.jpg'),
      ('budget-batch-cooking-turkey-and-lentil-tomato-stew', 'catalogue/budget-batch-cooking-turkey-and-lentil-tomato-stew.jpg'),
      ('budget-batch-cooking-chickpea-aubergine-curry', 'catalogue/budget-batch-cooking-chickpea-aubergine-curry.jpg'),
      ('budget-batch-cooking-kidney-bean-sweet-potato-stew', 'catalogue/budget-batch-cooking-kidney-bean-sweet-potato-stew.jpg'),
      ('budget-batch-cooking-chicken-vegetable-barley-stew', 'catalogue/budget-batch-cooking-chicken-vegetable-barley-stew.jpg'),
      ('budget-batch-cooking-lentil-mushroom-pasta-sauce', 'catalogue/budget-batch-cooking-lentil-mushroom-pasta-sauce.jpg'),
      ('budget-batch-cooking-black-bean-tomato-rice-pot', 'catalogue/budget-batch-cooking-black-bean-tomato-rice-pot.jpg'),
      ('budget-batch-cooking-pea-spinach-coconut-curry', 'catalogue/budget-batch-cooking-pea-spinach-coconut-curry.jpg'),
      ('budget-batch-cooking-beef-lentil-bolognese-pot', 'catalogue/budget-batch-cooking-beef-lentil-bolognese-pot.jpg')
    ) as media(slug, storage_path)
  loop
    select * into v_recipe
    from public.recipes
    where slug = v_media.slug
    for update;

    if not found or v_recipe.review_status <> 'approved' then
      raise exception 'Approved Budget Batch recipe % was not found', v_media.slug;
    end if;

    if v_recipe.image_path is not null then
      raise exception 'Budget Batch recipe % already has media', v_media.slug;
    end if;

    update public.recipes
    set content_version = content_version + 1,
        image_path = v_media.storage_path,
        media_attribution = jsonb_build_object(
          'ai_generated', true,
          'style_version', 'kitchen-companion-editorial-v1',
          'provider', 'OpenAI image generation',
          'model', 'Built-in image generation; model identifier not exposed',
          'generated_at', '2026-08-28T18:30:00Z',
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
      recipe_id, content_version, snapshot, verification_tier, created_by
    ) values (
      v_recipe.id,
      v_recipe.content_version,
      v_snapshot,
      v_recipe.verification_tier,
      v_reviewer
    );
  end loop;

  update public.meal_plans plan
  set image = recipe.image_path,
      title = recipe.title
  from public.recipes recipe
  where plan.plan_kind = 'catalogue'
    and plan.recipe_id = recipe.id::text
    and recipe.review_status = 'approved'
    and recipe.image_path is not null
    and (plan.image is null or plan.image is distinct from recipe.image_path);
end;
$$;
