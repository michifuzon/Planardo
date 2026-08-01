-- Invitar amigos directamente a un grupo (piden aceptar/rechazar),
-- además del link de invitación que ya existía.
set role postgres;

create table if not exists public.group_invite_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique(group_id, invited_user_id)
);
alter table public.group_invite_requests enable row level security;

-- FK directa a profiles (no solo auth.users) para que PostgREST pueda
-- traer el nombre de quien invitó en el mismo select (mismo motivo que
-- la migración 0014).
alter table public.group_invite_requests
  add constraint group_invite_requests_invited_by_profiles_fkey
  foreign key (invited_by) references public.profiles(id) on delete cascade;

create policy "group_invite_requests: involucrados ven"
  on public.group_invite_requests for select
  using (invited_user_id = auth.uid() or invited_by = auth.uid());

create or replace function public.invite_friend_to_group(target_group uuid, friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from group_members where group_id=target_group and user_id=auth.uid()) then
    raise exception 'No pertenecés a este grupo';
  end if;
  if exists(select 1 from group_members where group_id=target_group and user_id=friend_id) then
    return;
  end if;
  insert into group_invite_requests(group_id, invited_user_id, invited_by)
  values(target_group, friend_id, auth.uid())
  on conflict(group_id, invited_user_id) do update
    set status='pending', invited_by=excluded.invited_by, created_at=now()
    where group_invite_requests.status <> 'accepted';
end $$;
revoke all on function public.invite_friend_to_group(uuid,uuid) from public;
grant execute on function public.invite_friend_to_group(uuid,uuid) to authenticated;

create or replace function public.respond_group_invite_request(request_id uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare req record;
begin
  select * into req from group_invite_requests where id=request_id and invited_user_id=auth.uid() and status='pending';
  if req is null then raise exception 'Invitación no encontrada'; end if;
  if accept then
    insert into group_members(group_id,user_id,role) values(req.group_id,auth.uid(),'member') on conflict do nothing;
    update group_invite_requests set status='accepted' where id=request_id;
  else
    update group_invite_requests set status='declined' where id=request_id;
  end if;
end $$;
revoke all on function public.respond_group_invite_request(uuid,boolean) from public;
grant execute on function public.respond_group_invite_request(uuid,boolean) to authenticated;

create or replace function public.notify_group_invite_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  group_name text; group_emoji text; inviter_name text;
begin
  select name, emoji into group_name, group_emoji from groups where id=new.group_id;
  select name into inviter_name from profiles where id=new.invited_by;
  insert into notifications(user_id, type, title, body, group_id)
  values(new.invited_user_id, 'group_invite_request', inviter_name || ' te invitó a ' || group_emoji || ' ' || group_name, 'Tocá para aceptar o rechazar.', new.group_id);
  return new;
end $$;
drop trigger if exists on_group_invite_request_created on public.group_invite_requests;
create trigger on_group_invite_request_created after insert on public.group_invite_requests
for each row execute function public.notify_group_invite_request();
