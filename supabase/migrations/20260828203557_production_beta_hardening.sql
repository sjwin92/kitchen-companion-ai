-- Production beta hardening: fail-closed AI spend accounting and auditable
-- server-only maintenance operations.

alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_status_check;
alter table public.ai_usage_events
  add constraint ai_usage_events_status_check
  check (status in ('reserved', 'succeeded', 'failed', 'rejected', 'uncertain'));

create or replace function public.reserve_ai_budget(
  p_user_id uuid,
  p_capability text,
  p_provider text,
  p_model text,
  p_estimated_cost_gbp numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_month_start timestamptz := date_trunc('month', now());
  v_total numeric := 0;
  v_bucket numeric := 0;
  v_is_vision boolean := p_capability in ('inventory_vision', 'receipt_extraction', 'expiry_extraction', 'nutrition_estimate');
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_estimated_cost_gbp is null or p_estimated_cost_gbp < 0 or p_estimated_cost_gbp > 1 then
    raise exception 'Invalid estimated AI cost';
  end if;

  perform pg_advisory_xact_lock(hashtext(to_char(v_month_start, 'YYYY-MM')));

  select coalesce(sum(coalesce(actual_cost_gbp, estimated_cost_gbp)), 0)
  into v_total
  from public.ai_usage_events
  where created_at >= v_month_start and status in ('reserved', 'succeeded', 'uncertain');

  select coalesce(sum(coalesce(actual_cost_gbp, estimated_cost_gbp)), 0)
  into v_bucket
  from public.ai_usage_events
  where created_at >= v_month_start
    and status in ('reserved', 'succeeded', 'uncertain')
    and case when v_is_vision
      then capability in ('inventory_vision', 'receipt_extraction', 'expiry_extraction', 'nutrition_estimate')
      else capability in ('private_recipe_draft', 'catalogue_enrichment')
    end;

  if v_total + p_estimated_cost_gbp > 10 then
    raise exception 'Monthly AI budget reached';
  end if;
  if p_capability = 'private_recipe_draft' and v_total + p_estimated_cost_gbp > 9 then
    raise exception 'Private recipe drafting is paused near the monthly AI budget';
  end if;
  if v_is_vision and v_bucket + p_estimated_cost_gbp > 7 then
    raise exception 'Monthly vision allowance reached';
  end if;
  if not v_is_vision and v_bucket + p_estimated_cost_gbp > 2 then
    raise exception 'Monthly text allowance reached';
  end if;

  insert into public.ai_usage_events (
    user_id, capability, provider, model, status, estimated_cost_gbp
  ) values (
    p_user_id, p_capability, p_provider, p_model, 'reserved', p_estimated_cost_gbp
  ) returning id into v_event_id;
  return v_event_id;
end;
$$;

create or replace function public.complete_ai_usage(
  p_event_id uuid,
  p_status text,
  p_input_tokens integer default 0,
  p_output_tokens integer default 0,
  p_actual_cost_gbp numeric default null,
  p_provider_request_id text default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_status not in ('succeeded', 'failed', 'uncertain') then
    raise exception 'Invalid AI usage status';
  end if;
  update public.ai_usage_events
  set status = p_status,
      input_tokens = greatest(coalesce(p_input_tokens, 0), 0),
      output_tokens = greatest(coalesce(p_output_tokens, 0), 0),
      actual_cost_gbp = case
        when p_status = 'failed' then coalesce(p_actual_cost_gbp, 0)
        else p_actual_cost_gbp
      end,
      provider_request_id = nullif(p_provider_request_id, ''),
      error_code = nullif(p_error_code, ''),
      completed_at = now()
  where id = p_event_id and status = 'reserved';
  if not found then raise exception 'AI usage reservation not found'; end if;
end;
$$;

create or replace function public.get_ai_budget_status()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with usage as (
    select
      coalesce(sum(coalesce(actual_cost_gbp, estimated_cost_gbp)), 0) as total,
      coalesce(sum(coalesce(actual_cost_gbp, estimated_cost_gbp)) filter (
        where capability in ('inventory_vision', 'receipt_extraction', 'expiry_extraction', 'nutrition_estimate')
      ), 0) as vision,
      coalesce(sum(coalesce(actual_cost_gbp, estimated_cost_gbp)) filter (
        where capability in ('private_recipe_draft', 'catalogue_enrichment')
      ), 0) as text
    from public.ai_usage_events
    where created_at >= date_trunc('month', now())
      and status in ('reserved', 'succeeded', 'uncertain')
      and (user_id = auth.uid() or private.is_admin())
  )
  select jsonb_build_object(
    'total_gbp', total,
    'vision_gbp', vision,
    'text_gbp', text,
    'reserve_remaining_gbp', greatest(0, 10 - total),
    'hard_limit_gbp', 10,
    'private_drafts_available', total < 9 and text < 2,
    'paid_ai_available', total < 10
  ) from usage
$$;

grant execute on function public.get_ai_budget_status() to authenticated, service_role;
grant usage on schema private to service_role;
grant execute on function private.is_admin() to service_role;

revoke all on function public.reserve_ai_budget(uuid, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.complete_ai_usage(uuid, text, integer, integer, numeric, text, text) from public, anon, authenticated;
grant execute on function public.reserve_ai_budget(uuid, text, text, text, numeric) to service_role;
grant execute on function public.complete_ai_usage(uuid, text, integer, integer, numeric, text, text) to service_role;

create table if not exists public.maintenance_events (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  status text not null check (status in ('succeeded', 'failed')),
  affected_rows integer not null default 0 check (affected_rows >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.maintenance_events enable row level security;
revoke all on public.maintenance_events from public, anon, authenticated;
grant select, insert on public.maintenance_events to service_role;
create index if not exists maintenance_events_operation_created_idx
  on public.maintenance_events (operation, created_at desc);
comment on table public.maintenance_events is
  'Server-only audit records for scheduled retention and operational maintenance.';

-- Public catalogue administration is server-only. Authenticated clients retain
-- read access, while the service-role Edge boundary performs editorial writes.
revoke insert, update, delete on public.recipes from authenticated;
revoke insert, update, delete on public.recipe_books from authenticated;
revoke insert, update, delete on public.recipe_book_recipes from authenticated;
revoke insert, update, delete on public.creators from authenticated;
revoke insert, update, delete on public.creator_partnerships from authenticated;
revoke insert, update, delete on public.ingredients from authenticated;
revoke insert, update, delete on public.ingredient_aliases from authenticated;
revoke insert, update, delete on public.recipe_versions from authenticated;
revoke insert, update, delete on public.recipe_reviews from authenticated;
