-- Refine private beta candidate copy without changing its review state.
update public.recipes as recipe
set description = 'A practical '
  || case
    when 'breakfast' = any(recipe.meal_types) then 'breakfast'
    when 'lunch' = any(recipe.meal_types) then 'lunch'
    else 'dinner'
  end
  || ' '
  || case mod(book_recipe.position, 4)
    when 0 then 'designed to make good use of everyday ingredients.'
    when 1 then 'with a straightforward method that earns a place in the weekly rotation.'
    when 2 then 'balanced for an unfussy, satisfying home-cooked meal.'
    else 'made for practical planning without losing the pleasure of cooking.'
  end,
  updated_at = now()
from public.recipe_book_recipes as book_recipe
where book_recipe.recipe_id = recipe.id
  and recipe.catalogue_batch = 'beta-200'
  and recipe.review_status <> 'approved';

update public.recipes
set slug = 'fish-and-seafood-mackerel-cucumber-potato-bowls',
    title = 'Mackerel Cucumber Potato Bowls',
    dedupe_hash = 'e927d77888c1c571c6018ea19068e3aca2a887b660ec615f84c8a7be83e2ffd3',
    updated_at = now()
where slug = 'fish-and-seafood-mackerel-beet-free-potato-bowls'
  and catalogue_batch = 'beta-200'
  and review_status <> 'approved';
