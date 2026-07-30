-- Eliminación segura de grupos, permitida únicamente al creador.
set role postgres;

create or replace function public.delete_group(target_group uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not exists(select 1 from groups where id=target_group and created_by=auth.uid()) then
    raise exception 'Solo quien creó el grupo puede eliminarlo';
  end if;
  delete from groups where id=target_group and created_by=auth.uid();
  return found;
end $$;

revoke all on function public.delete_group(uuid) from public;
grant execute on function public.delete_group(uuid) to authenticated;
