-- Motor privado de calendario y disponibilidad.
-- Los usuarios ven detalles de su agenda; los grupos reciben únicamente bloques ocupado/libre.
set role postgres;

create or replace function public.get_personal_calendar(range_start timestamptz, range_end timestamptz)
returns table(
  plan_id uuid, name text, emoji text, starts_at timestamptz, ends_at timestamptz,
  color text, place_name text, response text, group_id uuid
)
language sql stable security definer set search_path=public
as $$
  select p.id,p.name,p.emoji,p.starts_at,p.ends_at,p.color,p.place_name,pm.response,p.group_id
  from plans p join plan_members pm on pm.plan_id=p.id
  where pm.user_id=auth.uid()
    and p.status in ('active','draft')
    and p.starts_at < range_end
    and coalesce(p.ends_at,p.starts_at+interval '2 hours') > range_start
  order by p.starts_at;
$$;
revoke all on function public.get_personal_calendar(timestamptz,timestamptz) from public;
grant execute on function public.get_personal_calendar(timestamptz,timestamptz) to authenticated;

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
  select p.id,p.name,p.avatar_color,p.avatar_url,plans.starts_at,
         coalesce(plans.ends_at,plans.starts_at+interval '2 hours')
  from group_members gm
  join profiles p on p.id=gm.user_id
  left join plan_members pm on pm.user_id=p.id and pm.response='going'
  left join plans on plans.id=pm.plan_id
    and plans.status='active'
    and plans.starts_at<range_end
    and coalesce(plans.ends_at,plans.starts_at+interval '2 hours')>range_start
  where gm.group_id=target_group
  order by p.name,plans.starts_at;
end $$;
revoke all on function public.get_group_availability(uuid,timestamptz,timestamptz) from public;
grant execute on function public.get_group_availability(uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.respond_to_plan(target_plan uuid, desired_response text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare target_start timestamptz; target_end timestamptz; conflicts jsonb;
begin
  if desired_response not in ('going','maybe','declined') then raise exception 'Respuesta inválida'; end if;
  if not exists(select 1 from plan_members where plan_id=target_plan and user_id=auth.uid()) then
    raise exception 'No estás invitado a este Planardo';
  end if;
  select starts_at,coalesce(ends_at,starts_at+interval '2 hours')
  into target_start,target_end from plans where id=target_plan;

  if desired_response='going' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.name,'emoji',p.emoji,'starts_at',p.starts_at,'ends_at',p.ends_at
    )),'[]'::jsonb) into conflicts
    from plans p join plan_members pm on pm.plan_id=p.id
    where pm.user_id=auth.uid() and pm.response='going' and p.status='active'
      and p.id<>target_plan and p.starts_at<target_end
      and coalesce(p.ends_at,p.starts_at+interval '2 hours')>target_start;
    if jsonb_array_length(conflicts)>0 then
      return jsonb_build_object('status','conflict','conflicts',conflicts);
    end if;
  end if;

  update plan_members set response=desired_response,responded_at=now()
  where plan_id=target_plan and user_id=auth.uid();
  return jsonb_build_object('status','updated','response',desired_response);
end $$;
revoke all on function public.respond_to_plan(uuid,text) from public;
grant execute on function public.respond_to_plan(uuid,text) to authenticated;
