-- Avoid per-row auth evaluation and overlapping permissive SELECT policies.

do $$
declare
  item record;
begin
  for item in select * from (values
    ('favorite_recipes', 'favorites'),
    ('meal_feedback', 'feedback'),
    ('meal_ratings', 'ratings'),
    ('meal_slot_settings', 'slot settings'),
    ('receipt_reconciliations', 'reconciliations'),
    ('staple_meals', 'staples'),
    ('user_interactions', 'interactions'),
    ('waste_log', 'waste log')
  ) as policies(table_name, noun)
  loop
    execute format('drop policy if exists %I on public.%I', 'Users can read own ' || item.noun, item.table_name);
    execute format('drop policy if exists %I on public.%I', 'Users can insert own ' || item.noun, item.table_name);
    execute format('drop policy if exists %I on public.%I', 'Users can delete own ' || item.noun, item.table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      'Users can read own ' || item.noun, item.table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      'Users can insert own ' || item.noun, item.table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      'Users can delete own ' || item.noun, item.table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'creators', 'recipe_book_access', 'recipe_book_recipes',
    'recipe_books', 'recipe_ingredients', 'recipes'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))',
      table_name || '_admin_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',
      table_name || '_admin_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))',
      table_name || '_admin_delete', table_name
    );
  end loop;
end;
$$;
