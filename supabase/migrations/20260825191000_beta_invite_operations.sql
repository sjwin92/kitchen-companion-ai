-- Narrow service/admin operation for issuing one-time, email-bound beta codes.
-- Only a SHA-256 hash is stored in the database.

create or replace function public.create_beta_invite(
  p_email text,
  p_code text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_email extensions.citext := lower(btrim(p_email))::extensions.citext;
  v_role text := auth.jwt() ->> 'role';
begin
  if not private.is_admin() and v_role <> 'service_role' then
    raise exception 'Administrator access required';
  end if;
  if v_email::text !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email address is required';
  end if;
  if length(p_code) < 12 then
    raise exception 'Invite code must contain at least 12 characters';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception 'Invite expiry must be within the next 30 days';
  end if;

  update private.beta_invites
  set code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex'),
      expires_at = p_expires_at,
      reserved_user_id = null,
      created_by = auth.uid(),
      created_at = now()
  where email = v_email
    and redeemed_at is null
  returning id into v_id;

  if v_id is null then
    insert into private.beta_invites (email, code_hash, expires_at, created_by)
    values (v_email, encode(extensions.digest(p_code, 'sha256'), 'hex'), p_expires_at, auth.uid())
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_beta_invite(text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.create_beta_invite(text, text, timestamptz)
  to authenticated, service_role;
