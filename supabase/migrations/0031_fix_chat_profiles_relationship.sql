-- Arregla el mismo error PGRST200 que ya afectó a grupos/planes: group_messages
-- y direct_messages apuntaban a auth.users, pero PostgREST necesita una FK
-- directa a public.profiles para poder traer el nombre/foto de quien escribió
-- en la misma consulta (select "profiles:user_id(...)"/"profiles:sender_id(...)").
-- Sin esto, el chat de grupo y el chat individual no cargan mensajes.
set role postgres;

alter table public.group_messages
  add constraint group_messages_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.direct_messages
  add constraint direct_messages_sender_id_profiles_fkey
  foreign key (sender_id) references public.profiles(id) on delete cascade;

alter table public.direct_messages
  add constraint direct_messages_recipient_id_profiles_fkey
  foreign key (recipient_id) references public.profiles(id) on delete cascade;

notify pgrst, 'reload schema';
