-- Notificaciones para: te invitan a un Planardo, te suman a un grupo.
-- Antes solo existía la de solicitud de amistad.
set role postgres;

alter table public.notifications add column if not exists group_id uuid references public.groups(id) on delete cascade;

create or replace function public.notify_plan_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_name text; plan_emoji text; creator_id uuid;
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
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  group_name text; group_emoji text; creator_id uuid;
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
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  addressee_name text;
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
