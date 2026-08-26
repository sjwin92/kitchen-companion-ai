-- User-owned atomic workflows rely on table RLS instead of bypassing it.

alter function public.complete_onboarding(jsonb) security invoker;
alter function public.move_shopping_items_to_inventory(jsonb) security invoker;
alter function public.confirm_meal_log(jsonb, uuid[], uuid, text, text, text, integer) security invoker;

drop policy if exists "Users can read own shopping items" on public.shopping_list;
drop policy if exists "Users can insert own shopping items" on public.shopping_list;
drop policy if exists "Users can delete own shopping items" on public.shopping_list;
create policy "Users can read own shopping items" on public.shopping_list for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert own shopping items" on public.shopping_list for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own shopping items" on public.shopping_list for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own meal logs" on public.meal_log;
drop policy if exists "Users can insert own meal logs" on public.meal_log;
drop policy if exists "Users can delete own meal logs" on public.meal_log;
create policy "Users can read own meal logs" on public.meal_log for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert own meal logs" on public.meal_log for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own meal logs" on public.meal_log for delete to authenticated
  using ((select auth.uid()) = user_id);

comment on function public.complete_onboarding(jsonb) is
  'User-owned profile mutation. SECURITY INVOKER ensures profile RLS remains authoritative.';
comment on function public.move_shopping_items_to_inventory(jsonb) is
  'Atomic user-owned shopping-to-inventory move. SECURITY INVOKER preserves RLS on every touched table.';
comment on function public.confirm_meal_log(jsonb, uuid[], uuid, text, text, text, integer) is
  'Atomic user-owned meal confirmation. SECURITY INVOKER preserves RLS on logs, inventory events and plans.';
