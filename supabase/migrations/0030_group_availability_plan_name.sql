-- Si alguien va a un plan del PROPIO grupo, mostrar "Va a [plan]" en vez de
-- excluirlo de la disponibilidad (antes quedaba afuera y parecía "libre").
-- Para planes de OTROS grupos seguimos sin exponer el nombre (solo ocupado).
set role postgres;

drop function if exists public.get_group_availability(uuid,timestamptz,timestamptz);

create function public.get_group_availability(
  target_group uuid, range_start timestamptz, range_end timestamptz
)
returns table(
  user_id uuid, name text, avatar_color text, avatar_url text,
  busy_from timestamptz, busy_until timestamptz, plan_name text, plan_emoji text
)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not exists(select 1 from group_members where group_id=target_group and group_members.user_id=auth.uid()) then
    raise exception 'No pertenecés a este grupo';
  end if;
  return query
  select p.id,p.name,p.avatar_color,p.avatar_url,busy.busy_from,busy.busy_until,busy.plan_name,busy.plan_emoji
  from group_members gm
  join profiles p on p.id=gm.user_id
  left join lateral (
    select plans.starts_at as busy_from, coalesce(plans.ends_at,plans.starts_at+interval '2 hours') as busy_until,
      case when plans.group_id=target_group then plans.name else null end as plan_name,
      case when plans.group_id=target_group then plans.emoji else null end as plan_emoji
    from plan_members pm join plans on plans.id=pm.plan_id
    where pm.user_id=p.id and pm.response='going' and plans.status='active'
      and plans.starts_at<range_end and coalesce(plans.ends_at,plans.starts_at+interval '2 hours')>range_start
    union all
    select (a.day + coalesce(a.time_from, time '00:00'))::timestamptz as busy_from,
           (a.day + coalesce(a.time_to, time '23:59:59'))::timestamptz as busy_until,
           null, null
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
