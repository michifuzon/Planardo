-- CATCH-UP: aplica de forma segura (re-ejecutable) todo lo de las
-- migraciones 0018 a 0033. No importa cuáles ya corriste antes: cada
-- "create policy" ahora tiene su "drop ... if exists" adelante, y el resto
-- ya usaba "if not exists" / "create or replace" / "drop trigger if exists".
set role postgres;

-- 0018: notificaciones de invitación a plan/grupo
alter table public.notifications add column if not exists group_id uuid references public.groups(id) on delete cascade;

create or replace function public.notify_plan_invite()
returns trigger language plpgsql security definer set search_path = public
as $$
declare plan_name text; plan_emoji text; creator_id uuid;
begin
  if new.role = 'host' then return new; end if;
  select name, emoji, created_by into plan_name, plan_emoji, creator_id from plans where id = new.plan_id;
  if creator_id = new.user_id then return new; end if;
  insert into notifications(user_id, type, title, body, plan_id)
  values(new.user_id, 'plan_invite', plan_emoji || ' Te invitaron a ' || plan_name, 'Tocá para ver los detalles y responder.', new.plan_id);
  return new;
end $$;
drop trigger if exists on_plan_member_added on public.plan_members;
create trigger on_plan_member_added after insert on public.plan_members
for each row execute function public.notify_plan_invite();

create or replace function public.notify_group_added()
returns trigger language plpgsql security definer set search_path = public
as $$
declare group_name text; group_emoji text; creator_id uuid;
begin
  if new.role = 'owner' then return new; end if;
  select name, emoji, created_by into group_name, group_emoji, creator_id from groups where id = new.group_id;
  if creator_id = new.user_id then return new; end if;
  insert into notifications(user_id, type, title, body, group_id)
  values(new.user_id, 'group_added', group_emoji || ' Te sumaron a ' || group_name, 'Ya podés ver sus planes y coordinar.', new.group_id);
  return new;
end $$;
drop trigger if exists on_group_member_added on public.group_members;
create trigger on_group_member_added after insert on public.group_members
for each row execute function public.notify_group_added();

create or replace function public.notify_friend_accepted()
returns trigger language plpgsql security definer set search_path = public
as $$
declare addressee_name text;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select name into addressee_name from profiles where id = new.addressee_id;
    insert into notifications(user_id, type, title, body)
    values(new.requester_id, 'friend_accepted', addressee_name || ' aceptó tu solicitud', 'Ya son amigos en Planardo.');
  end if;
  return new;
end $$;
drop trigger if exists on_friendship_accepted on public.friendships;
create trigger on_friendship_accepted after update on public.friendships
for each row execute function public.notify_friend_accepted();

-- 0019: invitar amigos directo a un grupo
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

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'group_invite_requests_invited_by_profiles_fkey') then
    alter table public.group_invite_requests
      add constraint group_invite_requests_invited_by_profiles_fkey
      foreign key (invited_by) references public.profiles(id) on delete cascade;
  end if;
end $$;

drop policy if exists "group_invite_requests: involucrados ven" on public.group_invite_requests;
create policy "group_invite_requests: involucrados ven"
  on public.group_invite_requests for select
  using (invited_user_id = auth.uid() or invited_by = auth.uid());

create or replace function public.invite_friend_to_group(target_group uuid, friend_id uuid)
returns void language plpgsql security definer set search_path = public
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
returns void language plpgsql security definer set search_path = public
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
returns trigger language plpgsql security definer set search_path = public
as $$
declare group_name text; group_emoji text; inviter_name text;
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

-- 0020: preview público de perfil (compartir perfil)
create or replace function public.get_public_profile(target_id uuid)
returns table(id uuid, name text, username text, avatar_color text, avatar_url text)
language sql security definer set search_path = public stable
as $$
  select id, name, username, avatar_color, avatar_url from profiles where id = target_id;
$$;
revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- 0021: compartir auto, borrar item de lista, "voy" marca ocupado
drop policy if exists "items: creador o dueño del plan elimina" on public.plan_items;
create policy "items: creador o dueño del plan elimina"
  on public.plan_items for delete
  using (created_by = auth.uid() or exists(select 1 from plans p where p.id = plan_id and p.created_by = auth.uid()));

alter table public.availability add column if not exists plan_id uuid references public.plans(id) on delete cascade;

create or replace function public.cancel_plan(target_plan uuid)
returns boolean language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not exists(select 1 from plans where id=target_plan and created_by=auth.uid()) then
    raise exception 'Solo quien organizó el Planardo puede darlo de baja';
  end if;
  update plans set status='cancelled',updated_at=now()
  where id=target_plan and created_by=auth.uid() and status<>'cancelled';
  delete from availability where plan_id=target_plan;
  return found;
end $$;
revoke all on function public.cancel_plan(uuid) from public;
grant execute on function public.cancel_plan(uuid) to authenticated;

create table if not exists public.plan_ride_passengers (
  plan_id uuid not null,
  driver_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(plan_id, driver_id, user_id),
  foreign key (plan_id, driver_id) references public.plan_transport(plan_id, user_id) on delete cascade
);
alter table public.plan_ride_passengers enable row level security;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plan_ride_passengers_user_id_profiles_fkey') then
    alter table public.plan_ride_passengers
      add constraint plan_ride_passengers_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

drop policy if exists "ride passengers: miembros ven" on public.plan_ride_passengers;
create policy "ride passengers: miembros ven"
  on public.plan_ride_passengers for select
  using (public.is_plan_member(plan_id));

create or replace function public.join_plan_ride(target_plan uuid, driver uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare t record; taken int;
begin
  if not public.is_plan_member(target_plan) then raise exception 'No pertenecés a este plan'; end if;
  if driver = auth.uid() then raise exception 'Sos vos quien maneja'; end if;
  select * into t from plan_transport where plan_id=target_plan and user_id=driver;
  if t is null or t.mode not in ('car','rideshare') then raise exception 'Ese viaje no existe'; end if;
  select count(*) into taken from plan_ride_passengers where plan_id=target_plan and driver_id=driver;
  if taken >= coalesce(t.seats_available,0) then raise exception 'No quedan lugares'; end if;
  delete from plan_ride_passengers where plan_id=target_plan and user_id=auth.uid();
  insert into plan_ride_passengers(plan_id, driver_id, user_id) values (target_plan, driver, auth.uid());
end $$;
revoke all on function public.join_plan_ride(uuid,uuid) from public;
grant execute on function public.join_plan_ride(uuid,uuid) to authenticated;

create or replace function public.leave_plan_ride(target_plan uuid, driver uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  delete from plan_ride_passengers where plan_id=target_plan and driver_id=driver and user_id=auth.uid();
end $$;
revoke all on function public.leave_plan_ride(uuid,uuid) from public;
grant execute on function public.leave_plan_ride(uuid,uuid) to authenticated;

-- 0022: notificar cambios/baja de un plan
create or replace function public.notify_plan_updated()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    insert into notifications(user_id, type, title, body, plan_id)
    select pm.user_id, 'plan_cancelled', new.emoji || ' ' || new.name || ' se dio de baja', 'El organizador canceló este Planardo.', new.id
    from plan_members pm where pm.plan_id = new.id and pm.user_id <> new.created_by;
  elsif new.status <> 'cancelled' and (
    old.starts_at is distinct from new.starts_at or
    old.ends_at is distinct from new.ends_at or
    old.place_name is distinct from new.place_name
  ) then
    insert into notifications(user_id, type, title, body, plan_id)
    select pm.user_id, 'plan_updated', new.emoji || ' ' || new.name || ' cambió', 'Se actualizó el horario o el lugar. Tocá para ver los detalles.', new.id
    from plan_members pm where pm.plan_id = new.id and pm.user_id <> new.created_by;
  end if;
  return new;
end $$;
drop trigger if exists on_plan_updated on public.plans;
create trigger on_plan_updated after update on public.plans
for each row execute function public.notify_plan_updated();

-- 0023: compartir un plan puntual por link
create table if not exists public.plan_invites (
  code text primary key default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  plan_id uuid not null references public.plans(id) on delete cascade,
  plan_name text not null,
  plan_emoji text not null,
  plan_color text not null,
  plan_group_id uuid references public.groups(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.plan_invites enable row level security;

drop policy if exists "plan invites: miembros del plan ven" on public.plan_invites;
create policy "plan invites: miembros del plan ven"
  on public.plan_invites for select
  using (public.is_plan_member(plan_id));

drop policy if exists "plan invites: preview público por código" on public.plan_invites;
create policy "plan invites: preview público por código"
  on public.plan_invites for select
  to anon
  using (true);

create or replace function public.create_plan_invite(target_plan uuid)
returns public.plan_invites
language plpgsql security definer set search_path = public
as $$
declare inv plan_invites; p record;
begin
  if not public.is_plan_member(target_plan) then raise exception 'No pertenecés a este plan'; end if;
  select name, emoji, color, group_id into p from plans where id = target_plan;
  insert into plan_invites(plan_id, plan_name, plan_emoji, plan_color, plan_group_id, created_by)
  values (target_plan, p.name, p.emoji, p.color, p.group_id, auth.uid())
  returning * into inv;
  return inv;
end $$;
revoke all on function public.create_plan_invite(uuid) from public;
grant execute on function public.create_plan_invite(uuid) to authenticated;

create or replace function public.join_plan_with_invite(invite_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target_plan uuid;
begin
  select plan_id into target_plan from plan_invites where code = invite_code;
  if target_plan is null then raise exception 'Invitación inválida'; end if;
  insert into plan_members(plan_id, user_id) values (target_plan, auth.uid())
  on conflict (plan_id, user_id) do nothing;
  return target_plan;
end $$;
revoke all on function public.join_plan_with_invite(text) from public;
grant execute on function public.join_plan_with_invite(text) to authenticated;

-- 0024: chat de grupo, chat individual, disponibilidad de un amigo
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.group_messages enable row level security;
drop policy if exists "group messages: miembros ven" on public.group_messages;
create policy "group messages: miembros ven"
  on public.group_messages for select
  using (exists(select 1 from group_members gm where gm.group_id=group_messages.group_id and gm.user_id=auth.uid()));
drop policy if exists "group messages: miembros envian" on public.group_messages;
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
drop policy if exists "dm: participantes ven" on public.direct_messages;
create policy "dm: participantes ven"
  on public.direct_messages for select
  using (sender_id=auth.uid() or recipient_id=auth.uid());
drop policy if exists "dm: solo entre amigos" on public.direct_messages;
create policy "dm: solo entre amigos"
  on public.direct_messages for insert
  with check (
    sender_id=auth.uid() and exists(
      select 1 from friendships f where f.status='accepted'
        and ((f.requester_id=auth.uid() and f.addressee_id=recipient_id)
          or (f.addressee_id=auth.uid() and f.requester_id=recipient_id))
    )
  );

drop function if exists public.get_friend_busy(uuid,timestamptz,timestamptz);
create function public.get_friend_busy(target_user uuid, range_start timestamptz, range_end timestamptz)
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

-- 0025: cuenta de administrador
alter table public.profiles add column if not exists is_admin boolean not null default false;

update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'miasilvestrini@gmail.com');

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "plans: host actualiza" on public.plans;
drop policy if exists "plans: host o admin actualiza" on public.plans;
create policy "plans: host o admin actualiza"
  on public.plans for update
  using (created_by = auth.uid() or public.is_admin());

create or replace function public.delete_plan(target_plan uuid)
returns boolean language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not exists(select 1 from plans where id=target_plan and (created_by=auth.uid() or public.is_admin())) then
    raise exception 'Solo quien organizó el Planardo puede eliminarlo';
  end if;
  delete from plans where id=target_plan;
  return found;
end $$;
revoke all on function public.delete_plan(uuid) from public;
grant execute on function public.delete_plan(uuid) to authenticated;

drop policy if exists "groups: el creador edita" on public.groups;
drop policy if exists "groups: creador o admin edita" on public.groups;
create policy "groups: creador o admin edita"
  on public.groups for update
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create or replace function public.delete_group(target_group uuid)
returns boolean language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not exists(select 1 from groups where id=target_group and (created_by=auth.uid() or public.is_admin())) then
    raise exception 'Solo quien creó el grupo puede eliminarlo';
  end if;
  update public.plans set status='cancelled', updated_at=now()
  where group_id=target_group and status<>'cancelled';
  delete from groups where id=target_group;
  return found;
end $$;
revoke all on function public.delete_group(uuid) from public;
grant execute on function public.delete_group(uuid) to authenticated;

drop policy if exists "items: creador o dueño del plan elimina" on public.plan_items;
drop policy if exists "items: creador, dueño del plan o admin elimina" on public.plan_items;
create policy "items: creador, dueño del plan o admin elimina"
  on public.plan_items for delete
  using (created_by = auth.uid() or exists(select 1 from plans p where p.id = plan_id and p.created_by = auth.uid()) or public.is_admin());

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

-- 0026: auto-invitar a planes activos al sumarte a un grupo + notis de chat
create or replace function public.invite_new_member_to_group_plans()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into plan_members(plan_id, user_id)
  select p.id, new.user_id from plans p
  where p.group_id = new.group_id and p.status = 'active'
  on conflict (plan_id, user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_group_member_added_invite_plans on public.group_members;
create trigger on_group_member_added_invite_plans after insert on public.group_members
for each row execute function public.invite_new_member_to_group_plans();

alter table public.notifications add column if not exists related_user_id uuid references public.profiles(id) on delete set null;

create or replace function public.notify_group_message()
returns trigger language plpgsql security definer set search_path = public
as $$
declare sender_name text; group_name text;
begin
  select name into sender_name from profiles where id = new.user_id;
  select name into group_name from groups where id = new.group_id;
  insert into notifications(user_id, type, title, body, group_id, related_user_id)
  select gm.user_id, 'group_message', sender_name || ' escribió en ' || group_name,
         left(new.body, 80), new.group_id, new.user_id
  from group_members gm where gm.group_id = new.group_id and gm.user_id <> new.user_id;
  return new;
end $$;
drop trigger if exists on_group_message_created on public.group_messages;
create trigger on_group_message_created after insert on public.group_messages
for each row execute function public.notify_group_message();

create or replace function public.notify_direct_message()
returns trigger language plpgsql security definer set search_path = public
as $$
declare sender_name text;
begin
  select name into sender_name from profiles where id = new.sender_id;
  insert into notifications(user_id, type, title, body, related_user_id)
  values(new.recipient_id, 'direct_message', sender_name || ' te envió un mensaje', left(new.body, 80), new.sender_id);
  return new;
end $$;
drop trigger if exists on_direct_message_created on public.direct_messages;
create trigger on_direct_message_created after insert on public.direct_messages
for each row execute function public.notify_direct_message();

-- 0027: mostrar "Va a [plan]" en disponibilidad de un amigo
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

-- 0028: gestionar invitados de un plan ya creado
drop policy if exists "plan_members: host invita" on public.plan_members;
drop policy if exists "plan_members: host, admin o uno mismo invita" on public.plan_members;
create policy "plan_members: host, admin o uno mismo invita"
  on public.plan_members for insert
  with check (
    exists(select 1 from public.plans p where p.id = plan_id and p.created_by = auth.uid())
    or user_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "plan_members: host, el propio invitado o admin borra" on public.plan_members;
create policy "plan_members: host, el propio invitado o admin borra"
  on public.plan_members for delete
  using (
    user_id = auth.uid()
    or exists(select 1 from public.plans p where p.id = plan_id and p.created_by = auth.uid())
    or public.is_admin()
  );

-- 0029: admin_list_users fallaba por tipo varchar vs text
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

-- 0030: "Va a [plan]" en el calendario grupal
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

-- 0031: FK del chat a profiles
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'group_messages_user_id_profiles_fkey') then
    alter table public.group_messages
      add constraint group_messages_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'direct_messages_sender_id_profiles_fkey') then
    alter table public.direct_messages
      add constraint direct_messages_sender_id_profiles_fkey
      foreign key (sender_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'direct_messages_recipient_id_profiles_fkey') then
    alter table public.direct_messages
      add constraint direct_messages_recipient_id_profiles_fkey
      foreign key (recipient_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- 0032: el organizador de un plan cuenta como miembro
create or replace function public.is_plan_member(target_plan uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from plan_members where plan_id = target_plan and user_id = auth.uid())
      or exists(select 1 from plans where id = target_plan and created_by = auth.uid())
$$;

-- 0033: borrar mensajes propios
drop policy if exists "group messages: autor borra" on public.group_messages;
create policy "group messages: autor borra" on public.group_messages for delete using (user_id = auth.uid());

drop policy if exists "dm: autor borra" on public.direct_messages;
create policy "dm: autor borra" on public.direct_messages for delete using (sender_id = auth.uid());

drop policy if exists "messages: autor borra" on public.plan_messages;
create policy "messages: autor borra" on public.plan_messages for delete using (user_id = auth.uid());

notify pgrst, 'reload schema';

-- Verificación final: debería devolver "ok" en todas las filas
select 'notifications.group_id' as chequeo, case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='group_id') then 'ok' else 'FALTA' end as estado
union all select 'notifications.related_user_id', case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='related_user_id') then 'ok' else 'FALTA' end
union all select 'group_invite_requests (tabla)', case when exists(select 1 from information_schema.tables where table_schema='public' and table_name='group_invite_requests') then 'ok' else 'FALTA' end
union all select 'plan_ride_passengers (tabla)', case when exists(select 1 from information_schema.tables where table_schema='public' and table_name='plan_ride_passengers') then 'ok' else 'FALTA' end
union all select 'plan_invites (tabla)', case when exists(select 1 from information_schema.tables where table_schema='public' and table_name='plan_invites') then 'ok' else 'FALTA' end
union all select 'group_messages (tabla)', case when exists(select 1 from information_schema.tables where table_schema='public' and table_name='group_messages') then 'ok' else 'FALTA' end
union all select 'direct_messages (tabla)', case when exists(select 1 from information_schema.tables where table_schema='public' and table_name='direct_messages') then 'ok' else 'FALTA' end
union all select 'plan_ride_passengers.user_id -> profiles (fk)', case when exists(select 1 from pg_constraint where conname='plan_ride_passengers_user_id_profiles_fkey') then 'ok' else 'FALTA' end
union all select 'group_messages.user_id -> profiles (fk)', case when exists(select 1 from pg_constraint where conname='group_messages_user_id_profiles_fkey') then 'ok' else 'FALTA' end
union all select 'is_admin (función)', case when exists(select 1 from pg_proc where proname='is_admin') then 'ok' else 'FALTA' end
union all select 'get_public_profile (función)', case when exists(select 1 from pg_proc where proname='get_public_profile') then 'ok' else 'FALTA' end
union all select 'borrar mensajes de grupo (policy)', case when exists(select 1 from pg_policies where tablename='group_messages' and policyname='group messages: autor borra') then 'ok' else 'FALTA' end;
