-- Si vos y tu amigo/a comparten un grupo y hay un plan de ese grupo al que
-- va, mostramos el nombre del plan ("Va a ..."). Para el resto (otros
-- grupos, otros amigos) seguimos mostrando solo ocupado/libre.
set role postgres;

drop function if exists public.get_friend_busy(uuid,timestamptz,timestamptz);

create function public.get_friend_busy(target_user uuid, range_start timestamptz, range_end timestamptz)
returns table(busy_from timestamptz, busy_until timestamptz, plan_name text, plan_emoji text)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not exists(
    select 1 from friendships where status='accepted'
      and ((requester_id=auth.uid() and addressee_id=target_user)
        or (addressee_id=auth.uid() and requester_id=target_user))
  ) then
    raise exception 'Solo podés ver la disponibilidad de tus amigos';
  end if;
  return query
  select p.starts_at, coalesce(p.ends_at, p.starts_at + interval '2 hours'),
    case when p.group_id is not null and exists(select 1 from group_members gm where gm.group_id=p.group_id and gm.user_id=auth.uid())
      then p.name else null end,
    case when p.group_id is not null and exists(select 1 from group_members gm where gm.group_id=p.group_id and gm.user_id=auth.uid())
      then p.emoji else null end
  from plan_members pm join plans p on p.id = pm.plan_id
  where pm.user_id = target_user and pm.response = 'going' and p.status = 'active'
    and p.starts_at < range_end and coalesce(p.ends_at, p.starts_at + interval '2 hours') > range_start
  union all
  select (a.day + coalesce(a.time_from, time '00:00'))::timestamptz,
         (a.day + coalesce(a.time_to, time '23:59'))::timestamptz,
         null, null
  from availability a
  where a.user_id = target_user and a.status = 'busy'
    and a.day >= range_start::date and a.day <= range_end::date;
end $$;
revoke all on function public.get_friend_busy(uuid,timestamptz,timestamptz) from public;
grant execute on function public.get_friend_busy(uuid,timestamptz,timestamptz) to authenticated;
