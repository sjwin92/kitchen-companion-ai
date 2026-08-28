-- Phase 2 budget buckets: £7 vision, £2 text, £1 reserve, £10 hard stop.

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
  where created_at >= v_month_start and status in ('reserved', 'succeeded');

  select coalesce(sum(coalesce(actual_cost_gbp, estimated_cost_gbp)), 0)
  into v_bucket
  from public.ai_usage_events
  where created_at >= v_month_start
    and status in ('reserved', 'succeeded')
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

revoke all on function public.reserve_ai_budget(uuid, text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.reserve_ai_budget(uuid, text, text, text, numeric) to service_role;
