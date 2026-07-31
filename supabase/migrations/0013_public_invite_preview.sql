-- Permite que la preview del link (WhatsApp, etc.) lea el nombre/emoji del
-- grupo sin estar logueado. El código de invitación ya funciona como el
-- secreto de acceso; esto solo expone nombre y emoji, no quién es parte.
set role postgres;

create policy "invites: preview público por código"
  on public.group_invites for select
  to anon
  using (true);
