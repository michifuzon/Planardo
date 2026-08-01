-- Notifica a los invitados cuando el organizador cambia el horario/lugar de
-- un Planardo, o lo da de baja. Antes solo se notificaba la invitación inicial.
set role postgres;

create or replace function public.notify_plan_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    insert into notifications(user_id, type, title, body, plan_id)
    select pm.user_id, 'plan_cancelled', new.emoji || ' ' || new.name || ' se dio de baja', 'El organizador canceló este Planardo.', new.id
    from plan_members pm where pm.plan_id = new.id and pm.user_id <> new.created_by;
  elsif new.status <> 'cancelled' and (
    old.starts_at is distinct from new.starts_at or
    old.ends_at is distinct from new.ends_at or
    old.place_name is distinct from new.place_name
  ) then
    insert into notifications(user_id, type, title, body, plan_id)
    select pm.user_id, 'plan_updated', new.emoji || ' ' || new.name || ' cambió', 'Se actualizó el horario o el lugar. Tocá para ver los detalles.', new.id
    from plan_members pm where pm.plan_id = new.id and pm.user_id <> new.created_by;
  end if;
  return new;
end $$;
drop trigger if exists on_plan_updated on public.plans;
create trigger on_plan_updated after update on public.plans
for each row execute function public.notify_plan_updated();
