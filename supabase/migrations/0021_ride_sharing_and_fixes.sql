-- Varias correcciones: poder eliminar cosas de un Planardo (todo reversible),
-- que "Voy" marque ocupado automáticamente en el calendario personal, y
-- compartir auto (sumarse al auto/uber de otro hasta llenar los lugares).
set role postgres;

-- Faltaba la política de DELETE para "Quién lleva qué": sin esto, borrar
-- un item quedaba bloqueado por RLS aunque el botón existiera.
create policy "items: creador o dueño del plan elimina"
  on public.plan_items for delete
  using (created_by = auth.uid() or exists(select 1 from plans p where p.id = plan_id and p.created_by = auth.uid()));

-- Etiqueta en "availability" para poder generar/borrar automáticamente el
-- bloque de "ocupado" que corresponde a un Planardo puntual, sin tocar los
-- bloques que la persona cargó a mano.
alter table public.availability add column if not exists plan_id uuid references public.plans(id) on delete cascade;

-- Al dar de baja un Planardo, liberamos la disponibilidad que había quedado
-- marcada como ocupada por él.
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
  delete from availability where plan_id=target_plan;
  return found;
end $$;
revoke all on function public.cancel_plan(uuid) from public;
grant execute on function public.cancel_plan(uuid) to authenticated;

-- Compartir auto: sumarse al auto/uber de quien maneja, hasta llenar lugares.
create table if not exists public.plan_ride_passengers (
  plan_id uuid not null,
  driver_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(plan_id, driver_id, user_id),
  foreign key (plan_id, driver_id) references public.plan_transport(plan_id, user_id) on delete cascade
);
alter table public.plan_ride_passengers enable row level security;

create policy "ride passengers: miembros ven"
  on public.plan_ride_passengers for select
  using (public.is_plan_member(plan_id));

create or replace function public.join_plan_ride(target_plan uuid, driver uuid)
returns void
language plpgsql security definer set search_path = public
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
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from plan_ride_passengers where plan_id=target_plan and driver_id=driver and user_id=auth.uid();
end $$;
revoke all on function public.leave_plan_ride(uuid,uuid) from public;
grant execute on function public.leave_plan_ride(uuid,uuid) to authenticated;
