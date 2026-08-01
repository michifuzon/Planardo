-- Si confirmás "Voy" a un plan del Grupo A, ese horario no debería
-- marcarte como ocupado dentro del calendario del propio Grupo A
-- (la razón de estar ocupado es justamente ese plan de ese grupo).
-- Sí debe seguir marcándote ocupado en cualquier OTRO grupo.
set role postgres;

create or replace function public.get_group_availability(
  target_group uuid, range_start timestamptz, range_end timestamptz
)
returns table(
  user_id uuid, name text, avatar_color text, avatar_url text,
  busy_from timestamptz, busy_until timestamptz
)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not exists(select 1 from group_members where group_id=target_group and group_members.user_id=auth.uid()) then
    raise exception 'No pertenecés a este grupo';
  end if;
  return query
  select p.id,p.name,p.avatar_color,p.avatar_url,busy.busy_from,busy.busy_until
  from group_members gm
  join profiles p on p.id=gm.user_id
  left join lateral (
    select plans.starts_at as busy_from, coalesce(plans.ends_at,plans.starts_at+interval '2 hours') as busy_until
    from plan_members pm join plans on plans.id=pm.plan_id
    where pm.user_id=p.id and pm.response='going' and plans.status='active'
      and plans.group_id is distinct from target_group
      and plans.starts_at<range_end and coalesce(plans.ends_at,plans.starts_at+interval '2 hours')>range_start
    union all
    select (a.day + coalesce(a.time_from, time '00:00'))::timestamptz as busy_from,
           (a.day + coalesce(a.time_to, time '23:59:59'))::timestamptz as busy_until
    from availability a
    where a.user_id=p.id and a.status='busy'
      and (a.day + coalesce(a.time_from,time '00:00'))::timestamptz < range_end
      and (a.day + coalesce(a.time_to,time '23:59:59'))::timestamptz > range_start
  ) busy on true
  where gm.group_id=target_group
  order by p.name,busy.busy_from;
end $$;
revoke all on function public.get_group_availability(uuid,timestamptz,timestamptz) from public;
grant execute on function public.get_group_availability(uuid,timestamptz,timestamptz) to authenticated;
