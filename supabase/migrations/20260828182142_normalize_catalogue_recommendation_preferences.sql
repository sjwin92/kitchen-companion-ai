-- User preferences are stored using their display labels (for example
-- "Vegan"), while the first recommendation function compared them to lower-
-- case literals. Normalize inside the authenticated RPC so dietary and
-- allergen gates remain authoritative regardless of UI capitalization.

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
      coalesce(array(
        select lower(btrim(value))
        from unnest(coalesce(dietary_preferences, '{}')) value
        where btrim(value) <> ''
      ), '{}')::text[] as diets,
      coalesce(array(
        select lower(btrim(value))
        from unnest(coalesce(allergies, '{}')) value
        where btrim(value) <> ''
      ), '{}')::text[] as allergies,
      coalesce(array(
        select lower(btrim(value))
        from unnest(coalesce(disliked_ingredients, '{}')) value
        where btrim(value) <> ''
      ), '{}')::text[] as dislikes,
      coalesce(array(
        select lower(btrim(value))
        from unnest(coalesce(preferred_cuisines, '{}')) value
        where btrim(value) <> ''
      ), '{}')::text[] as cuisines,
      greatest(coalesce(max_prep_time, 60), 1) as max_minutes,
      greatest(coalesce(daily_calorie_goal, 2000), 1) / 3.0 as meal_calories,
      coalesce(budget_sensitivity, 'medium') as budget_sensitivity
    from public.profiles
    where id = (select auth.uid())
  ), candidates as (
    select recipe.*
    from public.recipes recipe, profile preference
    where recipe.review_status = 'approved'
      and not exists (
        select 1
        from unnest(recipe.allergen_tags) tag
        where lower(btrim(tag)) = any(preference.allergies)
      )
      and (
        not ('vegan' = any(preference.diets))
        or exists (select 1 from unnest(recipe.dietary_tags) tag where lower(btrim(tag)) = 'vegan')
      )
      and (
        not ('vegetarian' = any(preference.diets))
        or exists (
          select 1 from unnest(recipe.dietary_tags) tag
          where lower(btrim(tag)) in ('vegetarian', 'vegan')
        )
      )
      and (
        not ('pescatarian' = any(preference.diets))
        or exists (
          select 1 from unnest(recipe.dietary_tags) tag
          where lower(btrim(tag)) in ('pescatarian', 'vegetarian', 'vegan')
        )
      )
      and (
        not ('gluten-free' = any(preference.diets))
        or exists (select 1 from unnest(recipe.dietary_tags) tag where lower(btrim(tag)) = 'gluten-free')
      )
      and (
        not ('dairy-free' = any(preference.diets))
        or not exists (
          select 1 from unnest(recipe.allergen_tags) tag
          where lower(btrim(tag)) = 'milk'
        )
      )
      and not exists (
        select 1
        from public.recipe_ingredients item, unnest(preference.dislikes) dislike
        where item.recipe_id = recipe.id
          and lower(item.name) like '%' || dislike || '%'
      )
      and (
        not ('halal' = any(preference.diets))
        or not exists (
          select 1
          from public.recipe_ingredients item
          where item.recipe_id = recipe.id
            and lower(item.normalized_name) = any(array['pork', 'bacon', 'ham', 'lard', 'gelatin', 'gelatine', 'alcohol', 'wine', 'beer', 'rum', 'bourbon', 'whiskey', 'whisky'])
        )
      )
      and (
        not ('kosher' = any(preference.diets))
        or not exists (
          select 1
          from public.recipe_ingredients item
          where item.recipe_id = recipe.id
            and lower(item.normalized_name) = any(array['pork', 'bacon', 'ham', 'lard', 'shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'squid', 'mussel', 'oyster'])
        )
      )
      and (
        nullif(btrim(p_search), '') is null
        or recipe.title ilike '%' || btrim(p_search) || '%'
        or exists (
          select 1 from unnest(recipe.cuisine_tags) tag
          where tag ilike '%' || btrim(p_search) || '%'
        )
        or exists (
          select 1 from public.recipe_ingredients item
          where item.recipe_id = recipe.id
            and item.name ilike '%' || btrim(p_search) || '%'
        )
      )
  ), ingredient_fit as (
    select
      recipe.id,
      count(item.id) filter (where not item.optional)::integer as required_count,
      count(item.id) filter (where not item.optional and inventory.food_id is not null)::integer as matched_count,
      count(item.id) filter (where not item.optional and inventory.food_id is null)::integer as missing_count,
      coalesce(array_agg(item.id) filter (where not item.optional and inventory.food_id is not null), '{}')::uuid[] as matched_ids,
      coalesce(array_agg(item.id) filter (where not item.optional and inventory.food_id is null), '{}')::uuid[] as missing_ids,
      count(item.id) filter (where not item.optional and inventory.freshness_state in ('use_today', 'use_soon'))::integer as rescue_count
    from candidates recipe
    left join public.recipe_ingredients item on item.recipe_id = recipe.id
    left join lateral (
      select food.id as food_id, food.freshness_state
      from public.current_inventory food
      left join public.ingredient_aliases alias on alias.alias = lower(btrim(food.name))
      where food.user_id = (select auth.uid())
        and (
          alias.ingredient_id = item.ingredient_id
          or lower(btrim(food.name)) = lower(btrim(item.normalized_name))
          or lower(food.name) like '%' || lower(item.normalized_name) || '%'
          or lower(item.normalized_name) like '%' || lower(food.name) || '%'
        )
      limit 1
    ) inventory on true
    group by recipe.id
  ), scored as (
    select
      recipe,
      fit.*,
      (recipe.image_path is not null) as has_image,
      case when fit.required_count = 0 then 1 else fit.matched_count::numeric / fit.required_count end as pantry_ratio,
      case when fit.matched_count = 0 then 0 else fit.rescue_count::numeric / fit.matched_count end as rescue_ratio,
      case when exists (
        select 1
        from unnest(recipe.cuisine_tags) tag, unnest(preference.cuisines) preferred
        where lower(tag) = preferred
      ) then 1 else 0.5 end as cuisine_fit,
      greatest(0, least(1, 1 - greatest((recipe.prep_minutes + recipe.cook_minutes) - preference.max_minutes, 0)::numeric / preference.max_minutes)) as prep_fit,
      case
        when recipe.estimated_cost_high_gbp is null then 0.6
        when preference.budget_sensitivity = 'high' then greatest(0, least(1, 1 - recipe.estimated_cost_high_gbp / 20))
        when preference.budget_sensitivity = 'medium' then greatest(0, least(1, 1 - recipe.estimated_cost_high_gbp / 35))
        else 1
      end as budget_fit,
      case
        when coalesce((recipe.nutrition ->> 'calories')::numeric, 0) <= 0 then 0.6
        else greatest(0, least(1, 1 - abs((recipe.nutrition ->> 'calories')::numeric - preference.meal_calories) / preference.meal_calories))
      end as nutrition_fit,
      case
        when memory.last_cooked_at > now() - interval '14 days' then 0
        else greatest(0, least(1, 1 - coalesce(memory.times_cooked, 0)::numeric / 12))
      end as variety_fit
    from candidates recipe
    join ingredient_fit fit on fit.id = recipe.id
    cross join profile preference
    left join public.recipe_memory memory
      on memory.recipe_id = recipe.id
      and memory.user_id = (select auth.uid())
  ), final as (
    select *,
      pantry_ratio * 30 + rescue_ratio * 25 + cuisine_fit * 15 + prep_fit * 10
      + budget_fit * 10 + variety_fit * 5 + nutrition_fit * 5 as total_score
    from scored
    where round(pantry_ratio * 100) >= greatest(0, least(100, p_min_match))
  )
  select
    ranked.id,
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
  from final ranked
  order by total_score desc, has_image desc, ranked.id
  limit greatest(1, least(coalesce(p_limit, 30), 100))
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.recommend_catalogue_recipes(integer, integer, text, integer)
  from public, anon;
grant execute on function public.recommend_catalogue_recipes(integer, integer, text, integer)
  to authenticated;
