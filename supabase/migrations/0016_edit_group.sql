-- Permite que el creador de un grupo edite sus datos (nombre, emoji, etc).
-- La tabla groups nunca tuvo política de UPDATE, así que hoy nadie puede editarla.
set role postgres;

create policy "groups: el creador edita"
  on public.groups for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
