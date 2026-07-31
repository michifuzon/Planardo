-- Arregla el error PGRST200 al traer los grupos: group_members/groups/
-- group_invites apuntaban a auth.users, pero Supabase necesita una relación
-- directa a public.profiles para poder traer el nombre/foto de cada
-- integrante en la misma consulta (así trabaja todo el resto de la app:
-- planes, amigos, encuestas, etc.).
set role postgres;

alter table public.group_members
  add constraint group_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.groups
  add constraint groups_created_by_profiles_fkey
  foreign key (created_by) references public.profiles(id) on delete cascade;

alter table public.group_invites
  add constraint group_invites_created_by_profiles_fkey
  foreign key (created_by) references public.profiles(id) on delete cascade;

notify pgrst, 'reload schema';
