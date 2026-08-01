-- admin_list_users fallaba con "structure of query does not match function
-- result type": auth.users.email es varchar, no text, y Postgres exige que
-- el tipo declarado en RETURNS TABLE coincida exactamente.
set role postgres;

create or replace function public.admin_list_users()
returns table(
  id uuid, email text, name text, username text, created_at timestamptz,
  group_count bigint, friend_count bigint, plan_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede ver esto'; end if;
  return query
  select
    p.id, u.email::text, p.name, p.username, p.created_at,
    (select count(*) from group_members gm where gm.user_id = p.id),
    (select count(*) from friendships f where f.status='accepted' and (f.requester_id=p.id or f.addressee_id=p.id)),
    (select count(*) from plan_members pm where pm.user_id = p.id)
  from profiles p join auth.users u on u.id = p.id
  order by p.created_at desc;
end $$;
revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;
