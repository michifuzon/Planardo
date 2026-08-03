-- Permite borrar los propios mensajes: chat de grupo, chat individual y
-- chat de un plan. Solo quien escribió el mensaje puede borrarlo.
set role postgres;

create policy "group messages: autor borra"
  on public.group_messages for delete
  using (user_id = auth.uid());

create policy "dm: autor borra"
  on public.direct_messages for delete
  using (sender_id = auth.uid());

create policy "messages: autor borra" on public.plan_messages for delete
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
