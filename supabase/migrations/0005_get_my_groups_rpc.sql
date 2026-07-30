-- Lectura atómica de los grupos del usuario autenticado.
-- Evita recursión y filtros inconsistentes en consultas anidadas con RLS.
set role postgres;

create or replace function public.get_my_groups()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'emoji', g.emoji,
        'color', g.color,
        'description', g.description,
        'photo_url', g.photo_url,
        'created_by', g.created_by,
        'members', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'name', p.name,
              'username', p.username,
              'avatar_color', p.avatar_color,
              'avatar_url', p.avatar_url,
              'role', gm.role
            )
            order by gm.joined_at
          )
          from public.group_members gm
          join public.profiles p on p.id = gm.user_id
          where gm.group_id = g.id
        ), '[]'::jsonb)
      )
      order by g.created_at desc
    ),
    '[]'::jsonb
  )
  from public.groups g
  join public.group_members mine on mine.group_id = g.id
  where mine.user_id = auth.uid();
$$;

revoke all on function public.get_my_groups() from public;
grant execute on function public.get_my_groups() to authenticated;
