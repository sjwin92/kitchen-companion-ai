-- Publish founder-reviewed Chicken Weeknights artwork. The first candidate was
-- also corrected from "couscous" to "vegetable": its ingredients and method
-- contain potatoes, peppers and courgettes, and no couscous.

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
      ('chicken-weeknights-lemon-chicken-couscous-traybake', 'chicken-weeknights-lemon-chicken-vegetable-traybake', 'Lemon Chicken Vegetable Traybake', 'catalogue/chicken-weeknights-lemon-chicken-vegetable-traybake.jpg'),
      ('chicken-weeknights-chicken-broccoli-noodle-stir-fry', 'chicken-weeknights-chicken-broccoli-noodle-stir-fry', 'Chicken Broccoli Noodle Stir-Fry', 'catalogue/chicken-weeknights-chicken-broccoli-noodle-stir-fry.jpg'),
      ('chicken-weeknights-chicken-spinach-coconut-curry', 'chicken-weeknights-chicken-spinach-coconut-curry', 'Chicken Spinach Coconut Curry', 'catalogue/chicken-weeknights-chicken-spinach-coconut-curry.jpg'),
      ('chicken-weeknights-chicken-mushroom-wholewheat-pasta', 'chicken-weeknights-chicken-mushroom-wholewheat-pasta', 'Chicken Mushroom Wholewheat Pasta', 'catalogue/chicken-weeknights-chicken-mushroom-wholewheat-pasta.jpg'),
      ('chicken-weeknights-paprika-chicken-rice-pot', 'chicken-weeknights-paprika-chicken-rice-pot', 'Paprika Chicken Rice Pot', 'catalogue/chicken-weeknights-paprika-chicken-rice-pot.jpg'),
      ('chicken-weeknights-chicken-black-bean-tacos', 'chicken-weeknights-chicken-black-bean-tacos', 'Chicken Black Bean Tacos', 'catalogue/chicken-weeknights-chicken-black-bean-tacos.jpg'),
      ('chicken-weeknights-mustard-chicken-potato-traybake', 'chicken-weeknights-mustard-chicken-potato-traybake', 'Mustard Chicken Potato Traybake', 'catalogue/chicken-weeknights-mustard-chicken-potato-traybake.jpg'),
      ('chicken-weeknights-chicken-tahini-quinoa-bowls', 'chicken-weeknights-chicken-tahini-quinoa-bowls', 'Chicken Tahini Quinoa Bowls', 'catalogue/chicken-weeknights-chicken-tahini-quinoa-bowls.jpg'),
      ('chicken-weeknights-chicken-tomato-barley-stew', 'chicken-weeknights-chicken-tomato-barley-stew', 'Chicken Tomato Barley Stew', 'catalogue/chicken-weeknights-chicken-tomato-barley-stew.jpg'),
      ('chicken-weeknights-chicken-pesto-pea-pasta', 'chicken-weeknights-chicken-pesto-pea-pasta', 'Chicken Pesto Pea Pasta', 'catalogue/chicken-weeknights-chicken-pesto-pea-pasta.jpg'),
      ('chicken-weeknights-chicken-sweet-potato-curry', 'chicken-weeknights-chicken-sweet-potato-curry', 'Chicken Sweet Potato Curry', 'catalogue/chicken-weeknights-chicken-sweet-potato-curry.jpg')
    ) as media(lookup_slug, published_slug, published_title, storage_path)
  loop
    select * into v_recipe
    from public.recipes
    where slug = v_media.lookup_slug
    for update;

    if not found or v_recipe.review_status <> 'approved' then
      raise exception 'Approved Chicken Weeknights recipe % was not found', v_media.lookup_slug;
    end if;

    if v_recipe.image_path is not null then
      raise exception 'Chicken Weeknights recipe % already has media', v_media.lookup_slug;
    end if;

    update public.recipes
    set content_version = content_version + 1,
        slug = v_media.published_slug,
        title = v_media.published_title,
        dedupe_hash = case
          when v_media.lookup_slug = 'chicken-weeknights-lemon-chicken-couscous-traybake'
            then '82938af985af3553880edc92cc60a69414595183622b2904674b1297632b2597'
          else dedupe_hash
        end,
        image_path = v_media.storage_path,
        media_attribution = jsonb_build_object(
          'ai_generated', true,
          'style_version', 'kitchen-companion-editorial-v1',
          'provider', 'OpenAI image generation',
          'model', 'Built-in image generation; model identifier not exposed',
          'generated_at', '2026-08-28T18:43:00Z',
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
        'title_ingredient_match_checked', true,
        'media_recipe_match_checked', true,
        'media_provenance_recorded', true
      ),
      'Founder-approved editorial recipe image. Title, ingredients and image were cross-checked; AI provenance and the reproduction prompt are recorded. Test-kitchen verification is not claimed.'
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
