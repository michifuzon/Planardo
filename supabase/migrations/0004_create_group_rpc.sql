-- Creación atómica de grupos. Evita que PostgREST evalúe el RETURNING
-- antes de que la membresía del dueño resulte visible por RLS.
set role postgres;

create or replace function public.create_group(
  group_name text,
  group_emoji text default '👥',
  group_color text default '#8b5cf6',
  group_description text default null
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para crear un grupo';
  end if;
  if nullif(trim(group_name),'') is null then
    raise exception 'El nombre del grupo es obligatorio';
  end if;

  insert into public.groups(name,emoji,color,description,created_by)
  values(trim(group_name),coalesce(group_emoji,'👥'),coalesce(group_color,'#8b5cf6'),nullif(trim(group_description),''),auth.uid())
  returning * into new_group;

  insert into public.group_members(group_id,user_id,role)
  values(new_group.id,auth.uid(),'owner')
  on conflict(group_id,user_id) do update set role='owner';

  return new_group;
end;
$$;

revoke all on function public.create_group(text,text,text,text) from public;
grant execute on function public.create_group(text,text,text,text) to authenticated;
