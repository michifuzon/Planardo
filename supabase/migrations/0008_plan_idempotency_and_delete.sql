-- Evita altas duplicadas y permite al organizador eliminar un Planardo.
set role postgres;

alter table public.plans add column if not exists creation_key uuid;
drop index if exists public.plans_creation_key_unique;
create unique index plans_creation_key_unique on public.plans(creation_key);

create or replace function public.delete_plan(target_plan uuid)
returns boolean
language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not exists(select 1 from plans where id=target_plan and created_by=auth.uid()) then
    raise exception 'Solo quien organizó el Planardo puede eliminarlo';
  end if;
  delete from plans where id=target_plan and created_by=auth.uid();
  return found;
end $$;
revoke all on function public.delete_plan(uuid) from public;
grant execute on function public.delete_plan(uuid) to authenticated;
