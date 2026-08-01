-- Permite que el organizador (o un admin) agregue o quite invitados de un
-- plan ya creado, y que cualquiera pueda salirse de un plan por su cuenta.
set role postgres;

drop policy if exists "plan_members: host invita" on public.plan_members;
create policy "plan_members: host, admin o uno mismo invita"
  on public.plan_members for insert
  with check (
    exists(select 1 from public.plans p where p.id = plan_id and p.created_by = auth.uid())
    or user_id = auth.uid()
    or public.is_admin()
  );

create policy "plan_members: host, el propio invitado o admin borra"
  on public.plan_members for delete
  using (
    user_id = auth.uid()
    or exists(select 1 from public.plans p where p.id = plan_id and p.created_by = auth.uid())
    or public.is_admin()
  );
