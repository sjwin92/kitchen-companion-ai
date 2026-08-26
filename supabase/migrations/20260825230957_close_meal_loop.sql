-- A planned meal can be confirmed once. This makes retrying the UI safe and
-- prevents duplicated calories, inventory events and recipe-memory signals.
create unique index if not exists meal_log_one_confirmation_per_plan_idx
  on public.meal_log (meal_plan_id)
  where meal_plan_id is not null;

create or replace function private.track_catalogue_recipe_planned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipe_id uuid;
begin
  if tg_op = 'UPDATE' and new.recipe_id is not distinct from old.recipe_id then
    return new;
  end if;
  if new.recipe_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return new;
  end if;
  v_recipe_id := new.recipe_id::uuid;
  if not exists (select 1 from public.recipes where id = v_recipe_id and review_status = 'approved') then
    return new;
  end if;
  insert into public.recipe_memory (user_id, recipe_id, times_planned, last_planned_at)
  values (new.user_id, v_recipe_id, 1, now())
  on conflict (user_id, recipe_id) do update
    set times_planned = public.recipe_memory.times_planned + 1,
        last_planned_at = excluded.last_planned_at;
  return new;
end;
$$;

create or replace function private.track_catalogue_recipe_consumed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipe_id uuid;
  v_recipe_text text;
begin
  if new.meal_plan_id is null then return new; end if;
  select recipe_id into v_recipe_text
  from public.meal_plans
  where id = new.meal_plan_id and user_id = new.user_id;
  if v_recipe_text is null
     or v_recipe_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return new;
  end if;
  v_recipe_id := v_recipe_text::uuid;
  if not exists (select 1 from public.recipes where id = v_recipe_id and review_status = 'approved') then
    return new;
  end if;
  insert into public.recipe_memory (user_id, recipe_id, times_cooked, last_cooked_at)
  values (new.user_id, v_recipe_id, 1, now())
  on conflict (user_id, recipe_id) do update
    set times_cooked = public.recipe_memory.times_cooked + 1,
        last_cooked_at = excluded.last_cooked_at;
  return new;
end;
$$;

drop trigger if exists meal_plans_track_catalogue_recipe on public.meal_plans;
create trigger meal_plans_track_catalogue_recipe
after insert or update of recipe_id on public.meal_plans
for each row execute function private.track_catalogue_recipe_planned();

drop trigger if exists meal_log_track_catalogue_recipe on public.meal_log;
create trigger meal_log_track_catalogue_recipe
after insert on public.meal_log
for each row execute function private.track_catalogue_recipe_consumed();

revoke execute on function private.track_catalogue_recipe_planned() from public, anon, authenticated;
revoke execute on function private.track_catalogue_recipe_consumed() from public, anon, authenticated;

-- Legacy meal memory is private. Cross-user discovery must pass through the
-- user_recipes -> recipe_submissions -> reviewed recipes editorial boundary.
drop policy if exists "Authenticated users can read shared meals" on public.meal_library;
drop policy if exists "Users can read own library meals" on public.meal_library;
drop policy if exists "Users can insert own library meals" on public.meal_library;
drop policy if exists "Users can update own library meals" on public.meal_library;
drop policy if exists "Users can delete own library meals" on public.meal_library;

create policy meal_library_select_own on public.meal_library for select to authenticated
  using ((select auth.uid()) = user_id);
create policy meal_library_insert_own on public.meal_library for insert to authenticated
  with check ((select auth.uid()) = user_id and lifecycle_status <> 'shared');
create policy meal_library_update_own on public.meal_library for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and lifecycle_status <> 'shared');
create policy meal_library_delete_own on public.meal_library for delete to authenticated
  using ((select auth.uid()) = user_id);
