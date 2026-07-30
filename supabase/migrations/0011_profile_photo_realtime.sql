-- Propaga cambios de nombre y foto a grupos, amistades y Planardos abiertos.
set role postgres;
do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
