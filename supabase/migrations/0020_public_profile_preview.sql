-- Compartir mi perfil: permite generar una preview pública (nombre, foto)
-- para el link de "agregame como amigo" sin exponer toda la tabla profiles
-- a usuarios anónimos (mismo motivo que la 0013 para invitaciones de grupo).
set role postgres;

create or replace function public.get_public_profile(target_id uuid)
returns table(id uuid, name text, username text, avatar_color text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  select id, name, username, avatar_color, avatar_url from profiles where id = target_id;
$$;
revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;
