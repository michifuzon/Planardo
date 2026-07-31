-- Al eliminar un grupo, da de baja (no borra) los Planardos que le pertenecían,
-- para que no queden flotando sin grupo. Igual que cancel_plan, conserva el
-- historial pero libera la disponibilidad de todos.
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

  update public.plans set status='cancelled', updated_at=now()
  where group_id=target_group and status<>'cancelled';

  delete from groups where id=target_group and created_by=auth.uid();
  return found;
end $$;

revoke all on function public.delete_group(uuid) from public;
grant execute on function public.delete_group(uuid) to authenticated;
