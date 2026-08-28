-- Final editorial media publication for the reviewed beta catalogue.
-- All artwork is AI-assisted editorial imagery. These records remain
-- editorial_reviewed and do not imply creator or test-kitchen verification.

update public.recipes
set
  title = 'Egg Mushroom Noodle Stir-Fry',
  description = replace(description, 'Egg Mushroom Rice Stir-Fry', 'Egg Mushroom Noodle Stir-Fry'),
  updated_at = now()
where slug = 'twenty-minute-meals-egg-mushroom-rice-stir-fry'
  and title = 'Egg Mushroom Rice Stir-Fry';

do $$
declare
  v_slugs jsonb;
begin
  select jsonb_agg(slug order by slug)
  into v_slugs
  from public.recipes
  where review_status = 'approved'
    and image_path is null
    and slug like any (array[
      'one-pot-dinners-%',
      'packed-lunches-%',
      'pasta-and-noodles-%',
      'plant-powered-%',
      'quick-breakfasts-%',
      'rice-and-grains-%',
      'soups-and-stews-%',
      'traybakes-%',
      'twenty-minute-meals-%',
      'vegetarian-comforts-%',
      'weekend-cooking-%'
    ]);

  if coalesce(jsonb_array_length(v_slugs), 0) <> 122 then
    raise exception 'Expected 122 final reviewed media records, found %',
      coalesce(jsonb_array_length(v_slugs), 0);
  end if;

  perform private.publish_editorial_media_pack(
    v_slugs,
    'catalogue/media/beta-200-image-queue.json',
    '2026-08-28T22:20:00Z'::timestamptz
  );
end;
$$;
