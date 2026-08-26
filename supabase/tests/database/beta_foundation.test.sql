begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;
select set_config('search_path', 'public,extensions', false);
select plan(51);

select ok(
  has_schema_privilege('supabase_auth_admin', 'private', 'USAGE'),
  'Supabase Auth can resolve the private before-user-created hook'
);

select has_table('public', 'creators', 'creator catalogue exists');
select has_column('private', 'beta_invites', 'reserved_at', 'invite reservations have a retry lease');
select has_table('public', 'recipe_books', 'recipe books exist');
select has_table('public', 'recipes', 'canonical recipes exist');
select has_table('public', 'inventory_events', 'inventory event history exists');
select has_table('public', 'ai_usage_daily', 'AI quota ledger exists');
select has_table('public', 'push_subscriptions', 'web push subscriptions exist');
select has_table('public', 'notification_preferences', 'notification preferences exist');
select has_table('public', 'recipe_reviews', 'human recipe review audit trail exists');
select has_column('public', 'recipes', 'rights_basis', 'recipes record their publishing rights basis');
select has_index(
  'public',
  'meal_log',
  'meal_log_one_confirmation_per_plan_idx',
  'a planned meal can only be confirmed once'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'meal_library'
      and policyname = 'Authenticated users can read shared meals'
  ),
  'legacy meal memory has no cross-user read policy'
);
select has_function(
  'public',
  'review_catalogue_recipe',
  array['uuid', 'text', 'jsonb', 'text'],
  'catalogue review uses the guarded approval function'
);
select has_function(
  'public',
  'create_beta_invite',
  array['text', 'text', 'timestamp with time zone'],
  'beta invitation issuance is a guarded function'
);
select ok(
  not has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'),
  'signup trigger function is not exposed as an RPC'
);
select ok(
  exists(select 1 from storage.buckets where id = 'meal-photos' and public = false),
  'meal photos use a private bucket'
);
select ok(
  exists(select 1 from storage.buckets where id = 'recipe-media' and public = true),
  'approved catalogue artwork uses a public media bucket'
);

insert into private.beta_invites (email, code_hash, expires_at)
values (
  'alpha@example.com',
  encode(extensions.digest('ABCDEFGHIJKL', 'sha256'), 'hex'),
  now() + interval '1 day'
);

select ok(
  private.hook_require_beta_invite(
    jsonb_build_object('user', jsonb_build_object(
      'id', '11111111-1111-1111-1111-111111111111',
      'email', 'alpha@example.com',
      'user_metadata', jsonb_build_object('invite_code', 'WRONG-CODE-00')
    ))
  ) ? 'error',
  'invalid invite is rejected'
);

select is(
  private.hook_require_beta_invite(
    jsonb_build_object('user', jsonb_build_object(
      'id', '11111111-1111-1111-1111-111111111111',
      'email', 'alpha@example.com',
      'user_metadata', jsonb_build_object('invite_code', 'ABCDEFGHIJKL')
    ))
  )::text,
  '{}'::text,
  'valid email-bound invite is accepted'
);

select is(
  (select reserved_user_id from private.beta_invites where email = 'alpha@example.com')::text,
  '11111111-1111-1111-1111-111111111111',
  'invite is reserved for the pending user'
);

update private.beta_invites
set reserved_at = now() - interval '1 minute'
where email = 'alpha@example.com';

select is(
  private.hook_require_beta_invite(
    jsonb_build_object('user', jsonb_build_object(
      'id', '33333333-3333-3333-3333-333333333333',
      'email', 'alpha@example.com',
      'user_metadata', jsonb_build_object('invite_code', 'ABCDEFGHIJKL')
    ))
  )::text,
  '{}'::text,
  'a stranded invite reservation can be retried after its short lease'
);

update private.beta_invites
set reserved_user_id = '11111111-1111-1111-1111-111111111111',
    reserved_at = now()
where email = 'alpha@example.com';

insert into auth.users (id, email, raw_user_meta_data)
values (
  '11111111-1111-1111-1111-111111111111',
  'alpha@example.com',
  '{"invite_code":"ABCDEFGHIJKL"}'::jsonb
);
insert into auth.users (id, email, raw_user_meta_data)
values ('22222222-2222-2222-2222-222222222222', 'beta@example.com', '{}'::jsonb);

select is(
  (select redeemed_user_id from private.beta_invites where email = 'alpha@example.com')::text,
  '11111111-1111-1111-1111-111111111111',
  'invite is redeemed after signup'
);
select ok(
  not ((select raw_user_meta_data from auth.users where id = '11111111-1111-1111-1111-111111111111') ? 'invite_code'),
  'invite code is removed from user metadata'
);
select ok(
  exists(select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'signup creates a profile'
);

insert into public.recipes (slug, title, review_status, published_at)
values
  ('approved-recipe', 'Approved recipe', 'approved', now()),
  ('draft-recipe', 'Draft recipe', 'draft', null),
  ('review-target', 'Review target', 'draft', null);

insert into public.food_items (id, user_id, name, expiry_date)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'Own carrots', current_date + 2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '22222222-2222-2222-2222-222222222222', 'Other carrots', current_date + 2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '11111111-1111-1111-1111-111111111111', 'Meal ingredient', current_date + 2);

insert into public.shopping_list (id, user_id, name, quantity, checked)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  '11111111-1111-1111-1111-111111111111',
  'Oats', '500 g', true
);

insert into public.meal_plans (id, user_id, recipe_id, title, planned_date, meal_slot)
values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111111', 'a', 'Meal A', '2026-09-01', 'dinner'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', '11111111-1111-1111-1111-111111111111', 'b', 'Meal B', '2026-09-02', 'lunch');

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is((select count(*) from public.recipes), 1::bigint, 'authenticated users see only approved recipes');
select is((select count(*) from public.recipes where slug = 'draft-recipe'), 0::bigint, 'draft recipes remain private');

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"role":"admin"}}',
  true
);
select throws_ok(
  $$select public.review_catalogue_recipe(
    (select id from public.recipes where slug = 'review-target'),
    'approved',
    '{"recipe_tested":true,"ingredient_quantities_checked":true,"allergens_checked":true,"rights_confirmed":true,"nutrition_source_checked":true}'::jsonb
  )$$,
  'P0001',
  'Recipe rights must be confirmed before approval',
  'approval is blocked until publishing rights are confirmed'
);
set local role postgres;
update public.recipes set rights_basis = 'original_owned' where slug = 'review-target';
set local role authenticated;
select lives_ok(
  $$select public.review_catalogue_recipe(
    (select id from public.recipes where slug = 'review-target'),
    'approved',
    '{"recipe_tested":true,"ingredient_quantities_checked":true,"allergens_checked":true,"rights_confirmed":true,"nutrition_source_checked":true}'::jsonb,
    'Test-kitchen pass'
  )$$,
  'a complete human review approves a recipe'
);
select is(
  (select review_status from public.recipes where slug = 'review-target'),
  'approved',
  'approved review publishes the reviewed version'
);
select is(
  (select count(*) from public.recipe_reviews where recipe_id = (select id from public.recipes where slug = 'review-target')),
  1::bigint,
  'approval records an immutable review event'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.create_beta_invite('blocked@example.com', 'ABCDEFGHIJKL', now() + interval '1 day')$$,
  'P0001',
  'Administrator access required',
  'ordinary users cannot issue beta invitations'
);
select is((select count(*) from public.current_inventory where user_id = '11111111-1111-1111-1111-111111111111'), 2::bigint, 'user sees own active inventory');
select is((select count(*) from public.current_inventory where user_id = '22222222-2222-2222-2222-222222222222'), 0::bigint, 'RLS hides another user inventory');

select is(
  (public.transition_inventory_item(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'consumed', null, 'test'
  )).lifecycle_state,
  'consumed',
  'inventory transition is atomic'
);
select ok(
  exists(
    select 1 from public.inventory_events
    where food_item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' and event_type = 'consumed'
  ),
  'inventory transition writes an event'
);
select throws_ok(
  $$select public.transition_inventory_item('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'consumed', null, 'test')$$,
  'P0001',
  'Inventory item not found',
  'user cannot transition another household inventory item'
);

select is(
  public.move_shopping_items_to_inventory(
    '[{"id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1","quantityValue":500,"unit":"g","location":"cupboard","daysUntilExpiry":90}]'::jsonb
  ),
  1,
  'checked shopping item moves to inventory once'
);
select is(
  (select count(*) from public.shopping_list where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'),
  0::bigint,
  'moved shopping row is removed in the same transaction'
);
select ok(
  exists(select 1 from public.current_inventory where name = 'Oats' and provenance = 'actual'),
  'moved shopping item becomes actual inventory'
);

select lives_ok(
  $$select public.move_meal_plan('cccccccc-cccc-cccc-cccc-ccccccccccc1', '2026-09-02', 'lunch')$$,
  'moving into an occupied slot swaps meals'
);
select is(
  (select title from public.meal_plans where planned_date = '2026-09-01' and meal_slot = 'dinner'),
  'Meal B',
  'occupied target moves back to the source slot'
);
select is(
  (select title from public.meal_plans where planned_date = '2026-09-02' and meal_slot = 'lunch'),
  'Meal A',
  'source meal reaches the requested slot'
);

select throws_ok(
  $$select public.confirm_meal_log(
    '{"title":"Bad range","calories":900,"protein_g":20,"carbs_g":30,"fat_g":10,"confidence":0.7,"ranges":{"calories":{"low":400,"high":600},"protein_g":{"low":15,"high":25},"carbs_g":{"low":20,"high":40},"fat_g":{"low":5,"high":15}}}'::jsonb,
    '{}'::uuid[]
  )$$,
  'P0001',
  'Nutrition point estimate must be inside its likely range',
  'nutrition point estimate must stay inside its likely range'
);

select ok(
  public.confirm_meal_log(
    '{"title":"Test dinner","calories":500,"protein_g":20,"carbs_g":50,"fat_g":15,"confidence":0.72,"model":"test-model","ingredients":["carrot"],"ranges":{"calories":{"low":420,"high":580},"protein_g":{"low":16,"high":24},"carbs_g":{"low":42,"high":58},"fat_g":{"low":11,"high":19}}}'::jsonb,
    array['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3']::uuid[],
    null,
    '11111111-1111-1111-1111-111111111111/test-meal.jpg'
  ) is not null,
  'confirmed nutrition estimate creates a meal log'
);
select is(
  (select lifecycle_state from public.food_items where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'),
  'consumed',
  'meal confirmation consumes selected inventory'
);
select ok(
  exists(
    select 1 from public.meal_log
    where title = 'Test dinner'
      and image_delete_after between now() + interval '89 days' and now() + interval '91 days'
  ),
  'meal photo receives a 90-day deletion deadline'
);

set local role postgres;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select is(
  (
    select count(*) from generate_series(1, 20)
    where public.consume_ai_quota('11111111-1111-1111-1111-111111111111', 'vision')
  ),
  20::bigint,
  'first twenty daily vision requests are accepted'
);
select is(
  public.consume_ai_quota('11111111-1111-1111-1111-111111111111', 'vision'),
  false,
  'twenty-first daily vision request is rejected'
);
select lives_ok(
  $$select public.create_beta_invite('new-beta@example.com', 'MNOPQRSTUVWX', now() + interval '7 days')$$,
  'service role can issue an email-bound beta invitation'
);
set local role postgres;
select is(
  (select length(code_hash) from private.beta_invites where email = 'new-beta@example.com'),
  64,
  'new invitation stores only a SHA-256 code hash'
);

select * from finish();
rollback;
