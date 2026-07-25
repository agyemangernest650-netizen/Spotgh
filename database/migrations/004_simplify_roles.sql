-- 004_simplify_roles.sql
-- SpotGH now only recognizes 3 roles in application logic: creator, business_owner, user.
-- Postgres can't drop enum values, so 'admin' and 'super_admin' remain valid in the
-- user_role type, but the app no longer grants them any special access — this migration
-- folds any existing accounts on those roles into 'creator' so no one silently loses access.

UPDATE public.users
SET role = 'creator'
WHERE role IN ('admin', 'super_admin');

-- Optional sanity check after running:
-- SELECT id, email, role FROM public.users WHERE role NOT IN ('creator','business_owner','user');
