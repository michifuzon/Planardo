-- Chat de grupo, chat individual (1:1, solo entre amigos) y disponibilidad
-- de un amigo (ocupado/libre, sin exponer el detalle del plan — mismo
-- criterio de privacidad que la disponibilidad grupal).
set role postgres;

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.group_messages enable row level security;
create policy "group messages: miembros ven"
  on public.group_messages for select
  using (exists(select 1 from group_members gm where gm.group_id=group_messages.group_id and gm.user_id=auth.uid()));
create policy "group messages: miembros envian"
  on public.group_messages for insert
  with check (user_id=auth.uid() and exists(select 1 from group_members gm where gm.group_id=group_messages.group_id and gm.user_id=auth.uid()));

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.direct_messages enable row level security;
create policy "dm: participantes ven"
  on public.direct_messages for select
  using (sender_id=auth.uid() or recipient_id=auth.uid());
create policy "dm: solo entre amigos"
  on public.direct_messages for insert
  with check (
    sender_id=auth.uid() and exists(
      select 1 from friendships f where f.status='accepted'
        and ((f.requester_id=auth.uid() and f.addressee_id=recipient_id)
          or (f.addressee_id=auth.uid() and f.requester_id=recipient_id))
    )
  );

create or replace function public.get_friend_busy(target_user uuid, range_start timestamptz, range_end timestamptz)
returns table(busy_from timestamptz, busy_until timestamptz)
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
  select p.starts_at, coalesce(p.ends_at, p.starts_at + interval '2 hours')
  from plan_members pm join plans p on p.id = pm.plan_id
  where pm.user_id = target_user and pm.response = 'going' and p.status = 'active'
    and p.starts_at < range_end and coalesce(p.ends_at, p.starts_at + interval '2 hours') > range_start
  union all
  select (a.day + coalesce(a.time_from, time '00:00'))::timestamptz,
         (a.day + coalesce(a.time_to, time '23:59'))::timestamptz
  from availability a
  where a.user_id = target_user and a.status = 'busy'
    and a.day >= range_start::date and a.day <= range_end::date;
end $$;
revoke all on function public.get_friend_busy(uuid,timestamptz,timestamptz) from public;
grant execute on function public.get_friend_busy(uuid,timestamptz,timestamptz) to authenticated;
