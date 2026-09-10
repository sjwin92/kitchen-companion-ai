-- Keep privileged editorial and invite mutations behind an authenticated Edge boundary.

create or replace function public.edge_review_catalogue_recipe(
  p_reviewer_id uuid,
  p_recipe_id uuid,
  p_decision text,
  p_checklist jsonb,
  p_notes text default null,
  p_verification_tier text default 'editorial_reviewed'
)
returns public.recipes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.recipes;
begin
  if auth.role() <> 'service_role' then raise exception 'Server access required'; end if;
  if not exists (
    select 1 from auth.users
    where id = p_reviewer_id and raw_app_meta_data ->> 'role' = 'admin'
  ) then raise exception 'Administrator access required'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_reviewer_id,
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'admin')
  )::text, true);

  select * into v_result
  from public.review_catalogue_recipe(
    p_recipe_id, p_decision, p_checklist, p_notes, p_verification_tier
  );
  return v_result;
end;
$$;

create or replace function public.edge_promote_recipe_submission(
  p_reviewer_id uuid,
  p_submission_id uuid,
  p_slug text,
  p_reviewer_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Server access required'; end if;
  if not exists (
    select 1 from auth.users
    where id = p_reviewer_id and raw_app_meta_data ->> 'role' = 'admin'
  ) then raise exception 'Administrator access required'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_reviewer_id,
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'admin')
  )::text, true);

  v_result := public.promote_recipe_submission(p_submission_id, p_slug, p_reviewer_notes);
  return v_result;
end;
$$;

revoke all on function public.edge_review_catalogue_recipe(uuid, uuid, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.edge_review_catalogue_recipe(uuid, uuid, text, jsonb, text, text) to service_role;
revoke all on function public.edge_promote_recipe_submission(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.edge_promote_recipe_submission(uuid, uuid, text, text) to service_role;

revoke execute on function public.review_catalogue_recipe(uuid, text, jsonb, text, text) from authenticated;
revoke execute on function public.promote_recipe_submission(uuid, text, text) from authenticated;
revoke execute on function public.create_beta_invite(text, text, timestamptz) from authenticated;

comment on function public.edge_review_catalogue_recipe(uuid, uuid, text, jsonb, text, text) is
  'Server-only editorial wrapper. Verifies the supplied reviewer is an auth admin before preserving reviewer provenance.';
comment on function public.edge_promote_recipe_submission(uuid, uuid, text, text) is
  'Server-only community promotion wrapper. Verifies the supplied reviewer is an auth admin before preserving reviewer provenance.';
