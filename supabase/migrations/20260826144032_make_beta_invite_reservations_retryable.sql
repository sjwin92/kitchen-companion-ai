-- Auth hooks commit before GoTrue sends its confirmation email. If that send
-- is throttled or fails, the provisional user id never reaches auth.users and
-- the old reservation would otherwise strand a valid one-time invite.
alter table private.beta_invites
  add column if not exists reserved_at timestamptz;

create or replace function private.hook_require_beta_invite(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email extensions.citext := lower(trim(event -> 'user' ->> 'email'));
  v_code text := trim(event -> 'user' -> 'user_metadata' ->> 'invite_code');
  v_user_id uuid := (event -> 'user' ->> 'id')::uuid;
  v_invite_id uuid;
begin
  if v_email is null or v_code is null or length(v_code) < 12 then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'A valid beta invitation is required.'
    ));
  end if;

  update private.beta_invites
  set reserved_user_id = v_user_id,
      reserved_at = now()
  where email = v_email
    and code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
    and redeemed_at is null
    and expires_at > now()
    and (
      reserved_user_id is null
      or reserved_user_id = v_user_id
      or reserved_at < now() - interval '30 seconds'
    )
  returning id into v_invite_id;

  if v_invite_id is null then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'This invitation is invalid, expired, or already used.'
    ));
  end if;

  return '{}'::jsonb;
end;
$$;

create or replace function private.finish_beta_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.beta_invites
  set redeemed_user_id = new.id,
      redeemed_at = now(),
      reserved_user_id = null,
      reserved_at = null
  where reserved_user_id = new.id
    and redeemed_at is null;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'invite_code'
  where id = new.id;
  return new;
end;
$$;

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
      reserved_at = null,
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
