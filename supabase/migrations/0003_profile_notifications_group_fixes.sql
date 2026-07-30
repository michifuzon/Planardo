-- Hotfix posterior a 0002. Seguro para proyectos que ya ejecutaron la migración anterior.
set role postgres;

create or replace function public.is_group_member(target_group uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from group_members where group_id = target_group and user_id = auth.uid()) $$;

drop policy if exists "groups: los miembros ven sus grupos" on public.groups;
create policy "groups: los miembros ven sus grupos" on public.groups for select using(public.is_group_member(id));
drop policy if exists "groups: cualquier autenticado puede crear" on public.groups;
create policy "groups: cualquier autenticado puede crear" on public.groups for insert with check(auth.uid()=created_by);
drop policy if exists "groups: creador actualiza" on public.groups;
create policy "groups: creador actualiza" on public.groups for update using(created_by=auth.uid()) with check(created_by=auth.uid());

drop policy if exists "group_members: los miembros ven la lista de su grupo" on public.group_members;
create policy "group_members: los miembros ven la lista de su grupo" on public.group_members for select using(public.is_group_member(group_id));

create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into group_members(group_id,user_id,role) values(new.id,new.created_by,'owner')
  on conflict do nothing;
  return new;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare base_username text;
begin
  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),'[^a-zA-Z0-9_]','','g'));
  if char_length(base_username)<3 then base_username:='user'; end if;
  insert into profiles(id,name,username)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),
    case when new.raw_user_meta_data->>'username' is not null then left(base_username,24)
         else left(base_username,18)||'_'||substr(new.id::text,1,5) end
  ) on conflict(id) do nothing;
  return new;
end $$;

create or replace function public.notify_friend_request()
returns trigger language plpgsql security definer set search_path=public as $$
declare requester_name text;
begin
  select name into requester_name from profiles where id=new.requester_id;
  insert into notifications(user_id,type,title,body)
  values(new.addressee_id,'friend_request',requester_name||' quiere ser tu amigo/a','Tocá para responder la solicitud.');
  return new;
end $$;
drop trigger if exists on_friend_request_created on public.friendships;
create trigger on_friend_request_created after insert on public.friendships
for each row execute function public.notify_friend_request();

insert into public.notifications(user_id,type,title,body)
select f.addressee_id,'friend_request',p.name||' quiere ser tu amigo/a','Tocá para responder la solicitud.'
from public.friendships f join public.profiles p on p.id=f.requester_id
where f.status='pending' and not exists(
  select 1 from public.notifications n
  where n.user_id=f.addressee_id and n.type='friend_request' and n.title=p.name||' quiere ser tu amigo/a'
);
