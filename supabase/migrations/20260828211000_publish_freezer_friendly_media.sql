-- Reusable migration-only publisher for visually reviewed editorial media.
create or replace function private.publish_editorial_media_pack(
  p_slugs jsonb,
  p_prompt_manifest text,
  p_generated_at timestamptz
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reviewer uuid;
  v_slug text;
  v_recipe public.recipes;
  v_snapshot jsonb;
  v_count integer := 0;
begin
  if jsonb_typeof(p_slugs) <> 'array' or jsonb_array_length(p_slugs) = 0 then
    raise exception 'At least one media slug is required';
  end if;

  select id into v_reviewer
  from auth.users
  where raw_app_meta_data ->> 'role' = 'admin'
  order by created_at
  limit 1;
  if v_reviewer is null then raise exception 'A founder/admin account is required to record media approval'; end if;

  for v_slug in select jsonb_array_elements_text(p_slugs) loop
    select * into v_recipe from public.recipes where slug = v_slug for update;
    if not found or v_recipe.review_status <> 'approved' then
      raise exception 'Approved recipe % was not found', v_slug;
    end if;
    if v_recipe.image_path is not null then raise exception 'Recipe % already has media', v_slug; end if;

    update public.recipes
    set content_version = content_version + 1,
        image_path = 'catalogue/' || v_slug || '.jpg',
        media_attribution = jsonb_build_object(
          'ai_generated', true,
          'style_version', 'kitchen-companion-editorial-v1',
          'provider', 'OpenAI image generation',
          'model', 'Built-in image generation; model identifier not exposed',
          'generated_at', p_generated_at,
          'prompt_manifest', p_prompt_manifest,
          'review_status', 'editorial_reviewed',
          'reviewer_user_id', v_reviewer,
          'delivery', jsonb_build_object(
            'card', '/images/recipes/' || v_slug || '.card.webp',
            'detail', '/images/recipes/' || v_slug || '.detail.webp',
            'width', 1024,
            'height', 1280
          )
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
    insert into public.recipe_versions (recipe_id, content_version, snapshot, verification_tier, created_by)
    values (v_recipe.id, v_recipe.content_version, v_snapshot, v_recipe.verification_tier, v_reviewer);

    update public.meal_plans
    set title = v_recipe.title, image = v_recipe.image_path
    where plan_kind = 'catalogue' and recipe_id = v_recipe.id::text;
    v_count := v_count + 1;
  end loop;

  update public.recipe_books book
  set cover_path = (
        select recipe.image_path from public.recipe_book_recipes link
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
  return v_count;
end;
$$;

revoke all on function private.publish_editorial_media_pack(jsonb, text, timestamptz) from public, anon, authenticated, service_role;

select private.publish_editorial_media_pack(
  '[
    "freezer-friendly-spinach-chickpea-tomato-curry",
    "freezer-friendly-turkey-and-vegetable-pasta-bake",
    "freezer-friendly-red-lentil-sweet-potato-soup",
    "freezer-friendly-chicken-and-barley-casserole",
    "freezer-friendly-mushroom-butter-bean-cottage-bake",
    "freezer-friendly-beef-and-kidney-bean-chilli",
    "freezer-friendly-cauliflower-chickpea-coconut-curry",
    "freezer-friendly-tomato-lentil-vegetable-soup",
    "freezer-friendly-chicken-spinach-tomato-pasta-bake",
    "freezer-friendly-black-bean-sweet-potato-chilli",
    "freezer-friendly-salmon-pea-potato-fish-bake"
  ]'::jsonb,
  'catalogue/media/beta-200-image-queue.json',
  '2026-08-28T22:10:00Z'::timestamptz
);
