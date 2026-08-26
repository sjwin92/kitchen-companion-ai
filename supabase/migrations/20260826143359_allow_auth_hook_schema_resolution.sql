-- GoTrue resolves Postgres auth hooks through the supabase_auth_admin role.
-- The hook itself is SECURITY DEFINER, but the caller still needs USAGE on
-- the private schema in order to resolve the function named by the hook URI.
grant usage on schema private to supabase_auth_admin;
