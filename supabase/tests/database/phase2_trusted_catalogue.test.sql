begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;
select set_config('search_path', 'public,extensions', false);
select plan(10);

insert into auth.users (id, email, raw_user_meta_data)
values ('44444444-4444-4444-4444-444444444444', 'phase2@example.com', '{}'::jsonb);

update public.profiles
set dietary_preferences = array['vegan']::text[],
    allergies = array['peanut']::text[]
where id = '44444444-4444-4444-4444-444444444444';

insert into public.recipes (id, slug, title, review_status, published_at, dietary_tags, allergen_tags, rights_basis)
values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'safe-vegan', 'Safe vegan bowl', 'approved', now(), array['vegan'], '{}', 'original_owned'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'meat-dinner', 'Beef dinner', 'approved', now(), '{}', '{}', 'original_owned'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'peanut-vegan', 'Peanut vegan bowl', 'approved', now(), array['vegan'], array['peanut'], 'original_owned');

select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.recommend_catalogue_recipes(30, 0, null, 0)),
  1::bigint,
  'diet and allergen conflicts are removed before ranking'
);
select is(
  (select recipe_id from public.recommend_catalogue_recipes(30, 0, null, 0))::text,
  'dddddddd-dddd-dddd-dddd-ddddddddddd1',
  'the safe canonical recipe remains discoverable'
);
select ok(
  not has_function_privilege('anon', 'public.recommend_catalogue_recipes(integer,integer,text,integer)', 'EXECUTE'),
  'anonymous callers cannot run personalized recommendations'
);
select ok(
  not has_table_privilege('authenticated', 'public.ai_usage_events', 'INSERT'),
  'clients cannot write the AI cost ledger'
);

set local role postgres;
insert into public.creators (id, slug, display_name)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'phase-two-creator', 'Phase Two Creator');

select throws_ok(
  $$insert into public.creator_partnerships (creator_id, status)
    values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'contacted')$$,
  '23514',
  'new row for relation "creator_partnerships" violates check constraint "creator_contact_requires_approval"',
  'creator outreach cannot be recorded before founder approval'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"service_role"}',
  true
);
set local role service_role;

select is(
  (select count(*) from generate_series(1, 8)
   where public.reserve_ai_budget(
     '44444444-4444-4444-4444-444444444444', 'inventory_vision', 'gemini', 'gemini-3.5-flash-lite', 1
   ) is not null),
  8::bigint,
  'vision reservations can use the £7 allowance plus the £1 reserve'
);
select lives_ok(
  $$select public.reserve_ai_budget(
    '44444444-4444-4444-4444-444444444444', 'catalogue_enrichment', 'deepseek', 'deepseek-v4-flash', 1
  )$$,
  'the first £1 text reservation is accepted'
);
select throws_ok(
  $$select public.reserve_ai_budget(
    '44444444-4444-4444-4444-444444444444', 'private_recipe_draft', 'gemini', 'gemini-3.5-flash-lite', 0.01
  )$$,
  'P0001',
  'Private recipe drafting is paused near the monthly AI budget',
  'private recipe generation pauses above 90 percent'
);
select lives_ok(
  $$select public.reserve_ai_budget(
    '44444444-4444-4444-4444-444444444444', 'catalogue_enrichment', 'deepseek', 'deepseek-v4-flash', 1
  )$$,
  'non-personal text enrichment can reach the exact £10 boundary'
);
select throws_ok(
  $$select public.reserve_ai_budget(
    '44444444-4444-4444-4444-444444444444', 'nutrition_estimate', 'gemini', 'gemini-3.5-flash-lite', 0.01
  )$$,
  'P0001',
  'Monthly AI budget reached',
  'every paid call is rejected beyond the £10 cap'
);

select * from finish();
rollback;
