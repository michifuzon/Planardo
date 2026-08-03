-- "No se puede anotar" en la lista colaborativa (y potencialmente otros
-- permisos del plan): quien ORGANIZA un Planardo nunca se agrega a sí mismo
-- en plan_members (createPlan solo inserta ahí a los invitados), pero
-- is_plan_member() -que usan casi todas las políticas de un plan: items,
-- checklist, timeline, gastos, fotos, comentarios, mensajes, encuestas,
-- autos compartidos- solo miraba esa tabla. Resultado: el organizador
-- quedaba afuera de sus propios permisos en todo lo relacionado al plan.
set role postgres;

create or replace function public.is_plan_member(target_plan uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from plan_members where plan_id = target_plan and user_id = auth.uid())
      or exists(select 1 from plans where id = target_plan and created_by = auth.uid())
$$;
