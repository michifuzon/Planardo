-- Baja lógica de Planardos. Conserva datos e historial y libera disponibilidad.
set role postgres;

create or replace function public.cancel_plan(target_plan uuid)
returns boolean
language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not exists(select 1 from plans where id=target_plan and created_by=auth.uid()) then
    raise exception 'Solo quien organizó el Planardo puede darlo de baja';
  end if;
  update plans set status='cancelled',updated_at=now()
  where id=target_plan and created_by=auth.uid() and status<>'cancelled';
  return found;
end $$;

revoke all on function public.cancel_plan(uuid) from public;
grant execute on function public.cancel_plan(uuid) to authenticated;
