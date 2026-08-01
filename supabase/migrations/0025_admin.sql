-- Cuenta de administrador: puede editar/cancelar/eliminar cualquier plan o
-- grupo (no solo los propios), y tiene acceso a un panel con el listado de
-- usuarios (email vía auth.users, que la API normalmente no expone).
set role postgres;

alter table public.profiles add column if not exists is_admin boolean not null default false;

update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'miasilvestrini@gmail.com');

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Planes: el admin puede editar/actualizar cualquiera.
drop policy if exists "plans: host actualiza" on public.plans;
create policy "plans: host o admin actualiza"
  on public.plans for update
  using (created_by = auth.uid() or public.is_admin());

create or replace function public.cancel_plan(target_plan uuid)
returns boolean
language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not exists(select 1 from plans where id=target_plan and (created_by=auth.uid() or public.is_admin())) then
    raise exception 'Solo quien organizó el Planardo puede darlo de baja';
  end if;
  update plans set status='cancelled',updated_at=now()
  where id=target_plan and status<>'cancelled';
  delete from availability where plan_id=target_plan;
  return found;
end $$;
revoke all on function public.cancel_plan(uuid) from public;
grant execute on function public.cancel_plan(uuid) to authenticated;

create or replace function public.delete_plan(target_plan uuid)
returns boolean
language plpgsql security definer set search_path=public
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

-- Grupos: el admin puede editar/eliminar cualquiera.
drop policy if exists "groups: el creador edita" on public.groups;
create policy "groups: creador o admin edita"
  on public.groups for update
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create or replace function public.delete_group(target_group uuid)
returns boolean
language plpgsql
security definer
set search_path=public
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

-- Items de lista colaborativa: el admin también puede eliminar cualquiera.
drop policy if exists "items: creador o dueño del plan elimina" on public.plan_items;
create policy "items: creador, dueño del plan o admin elimina"
  on public.plan_items for delete
  using (created_by = auth.uid() or exists(select 1 from plans p where p.id = plan_id and p.created_by = auth.uid()) or public.is_admin());

-- Panel de admin: listado de personas con su email (auth.users no es accesible
-- por la API normalmente), cantidad de grupos y de amigos.
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
    p.id, u.email, p.name, p.username, p.created_at,
    (select count(*) from group_members gm where gm.user_id = p.id),
    (select count(*) from friendships f where f.status='accepted' and (f.requester_id=p.id or f.addressee_id=p.id)),
    (select count(*) from plan_members pm where pm.user_id = p.id)
  from profiles p join auth.users u on u.id = p.id
  order by p.created_at desc;
end $$;
revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;
