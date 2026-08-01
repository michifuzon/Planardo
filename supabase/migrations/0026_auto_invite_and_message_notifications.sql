-- Si alguien se suma a un grupo que ya tiene planes activos, se lo invita
-- automáticamente a esos planes (antes quedaban afuera de planes creados
-- antes de sumarse). También notificaciones de mensajes de chat.
set role postgres;

create or replace function public.invite_new_member_to_group_plans()
returns trigger
language plpgsql security definer set search_path = public
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
returns trigger
language plpgsql security definer set search_path = public
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
returns trigger
language plpgsql security definer set search_path = public
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
