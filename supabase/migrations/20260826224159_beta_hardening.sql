-- Public-beta correctness and least-privilege hardening.

alter table public.meal_plans
  add column if not exists plan_kind text,
  add column if not exists inventory_item_id uuid references public.food_items(id) on delete set null;

update public.meal_plans mp
set plan_kind = case
  when mp.recipe_id like 'custom-%' then 'custom'
  when exists (select 1 from public.user_recipes ur where ur.id::text = mp.recipe_id) then 'user_recipe'
  when exists (select 1 from public.recipes r where r.id::text = mp.recipe_id) then 'catalogue'
  else 'custom'
end
where mp.plan_kind is null;

alter table public.meal_plans
  alter column plan_kind set default 'custom',
  alter column plan_kind set not null;

alter table public.meal_plans
  drop constraint if exists meal_plans_plan_kind_check;

alter table public.meal_plans
  add constraint meal_plans_plan_kind_check
  check (plan_kind in ('catalogue', 'user_recipe', 'custom', 'inventory'));

create index if not exists meal_plans_inventory_item_idx
  on public.meal_plans (inventory_item_id)
  where inventory_item_id is not null;

-- This RPC swaps an occupied target instead of deleting it and runs as the
-- caller, so the normal ownership policies remain authoritative.
drop function if exists public.move_meal_plan(uuid, date, text);

create or replace function public.move_meal_plan(
  p_plan_id uuid,
  p_target_date date,
  p_target_slot text
)
returns setof public.meal_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_source public.meal_plans;
  v_target public.meal_plans;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_target_slot not in ('breakfast', 'lunch', 'dinner', 'snack', 'lunchbox') then
    raise exception 'Invalid meal slot';
  end if;

  select * into v_source
  from public.meal_plans
  where id = p_plan_id and user_id = v_user_id
  for update;
  if v_source.id is null then raise exception 'Meal plan not found'; end if;

  select * into v_target
  from public.meal_plans
  where user_id = v_user_id
    and planned_date = p_target_date
    and meal_slot = p_target_slot
    and id <> v_source.id
  for update;

  if v_target.id is not null then
    update public.meal_plans
    set meal_slot = '__moving__' || v_target.id::text
    where id = v_target.id and user_id = v_user_id;

    update public.meal_plans
    set planned_date = p_target_date, meal_slot = p_target_slot
    where id = v_source.id and user_id = v_user_id;

    update public.meal_plans
    set planned_date = v_source.planned_date, meal_slot = v_source.meal_slot
    where id = v_target.id and user_id = v_user_id;
  else
    update public.meal_plans
    set planned_date = p_target_date, meal_slot = p_target_slot
    where id = v_source.id and user_id = v_user_id;
  end if;

  return query
  select mp.*
  from public.meal_plans mp
  where mp.user_id = v_user_id
    and mp.id in (v_source.id, v_target.id)
  order by mp.planned_date, mp.meal_slot, mp.id;
end;
$$;

revoke all on function public.move_meal_plan(uuid, date, text) from public, anon;
grant execute on function public.move_meal_plan(uuid, date, text) to authenticated;

-- Allow the inventory lifecycle transaction to run with the caller's RLS
-- context instead of bypassing policies as the function owner.
grant insert on public.inventory_events to authenticated;

drop policy if exists inventory_events_own_insert on public.inventory_events;
create policy inventory_events_own_insert
on public.inventory_events for insert
to authenticated
with check ((select auth.uid()) = user_id);

create or replace function public.transition_inventory_item(
  p_item_id uuid,
  p_to_state text,
  p_quantity_delta numeric default null,
  p_reason text default null
)
returns public.food_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_item public.food_items;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_to_state not in ('available', 'reserved', 'consumed', 'wasted', 'discarded') then
    raise exception 'Invalid inventory state';
  end if;

  select * into v_item
  from public.food_items
  where id = p_item_id and user_id = v_user_id
  for update;
  if v_item.id is null then raise exception 'Inventory item not found'; end if;

  update public.food_items
  set lifecycle_state = p_to_state,
      quantity_value = case
        when p_quantity_delta is null then quantity_value
        else greatest(coalesce(quantity_value, 0) + p_quantity_delta, 0)
      end,
      version = version + 1,
      updated_at = now()
  where id = p_item_id and user_id = v_user_id
  returning * into v_item;

  insert into public.inventory_events (
    user_id, food_item_id, event_type, quantity_delta, unit, reason
  ) values (
    v_user_id,
    p_item_id,
    case p_to_state
      when 'available' then 'released'
      when 'reserved' then 'reserved'
      when 'consumed' then 'consumed'
      when 'wasted' then 'wasted'
      else 'discarded'
    end,
    p_quantity_delta,
    v_item.unit,
    p_reason
  );

  if p_to_state = 'wasted' then
    insert into public.waste_log (user_id, name, quantity, reason)
    values (v_user_id, v_item.name, v_item.quantity, coalesce(p_reason, 'expired'));
  end if;

  return v_item;
end;
$$;

revoke all on function public.transition_inventory_item(uuid, text, numeric, text) from public, anon;
grant execute on function public.transition_inventory_item(uuid, text, numeric, text) to authenticated;

-- Replace the oldest per-row auth calls on the hottest beta tables.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated
using ((select auth.uid()) = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can read own food items" on public.food_items;
create policy "Users can read own food items" on public.food_items for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own food items" on public.food_items;
create policy "Users can insert own food items" on public.food_items for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own food items" on public.food_items;
create policy "Users can delete own food items" on public.food_items for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own meal plans" on public.meal_plans;
create policy "Users can read own meal plans" on public.meal_plans for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own meal plans" on public.meal_plans;
create policy "Users can insert own meal plans" on public.meal_plans for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own meal plans" on public.meal_plans;
create policy "Users can delete own meal plans" on public.meal_plans for delete to authenticated
using ((select auth.uid()) = user_id);
