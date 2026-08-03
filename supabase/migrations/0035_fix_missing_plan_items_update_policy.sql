-- La política de UPDATE de plan_items (lista colaborativa / "Anotarme")
-- nunca existió en la base real, aunque estaba en la migración 0002 desde
-- el principio (pg_policies solo mostraba DELETE/INSERT/SELECT). Sin ella,
-- con RLS habilitado, cualquier update quedaba bloqueado en silencio (0
-- filas afectadas, sin error de Postgres) y solo se veía "No se pudo
-- actualizar el item (revisá los permisos)".
set role postgres;

drop policy if exists "items: miembros actualizan" on public.plan_items;
create policy "items: miembros actualizan"
  on public.plan_items for update
  using (public.is_plan_member(plan_id));

notify pgrst, 'reload schema';
