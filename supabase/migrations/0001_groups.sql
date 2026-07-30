-- PLANARDO: perfiles, grupos, miembros e invitaciones por link
-- Correr una sola vez en Supabase Dashboard -> SQL Editor -> New query -> Run

create extension if not exists pgcrypto;

-- ─── profiles ──────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_color text not null default '#8b5cf6',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: cualquier autenticado puede ver"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "profiles: el dueño puede actualizar el suyo"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- backfill por si ya hay usuarios sin perfil
insert into public.profiles (id, name)
select id, coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- ─── groups ────────────────────────────────────────────────
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '👥',
  color text not null default '#8b5cf6',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;

-- ─── group_members ─────────────────────────────────────────
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_members enable row level security;

create policy "groups: los miembros ven sus grupos"
  on public.groups for select
  using (exists (
    select 1 from public.group_members gm
    where gm.group_id = groups.id and gm.user_id = auth.uid()
  ));

create policy "groups: cualquier autenticado puede crear"
  on public.groups for insert
  with check (auth.uid() = created_by);

create policy "group_members: los miembros ven la lista de su grupo"
  on public.group_members for select
  using (exists (
    select 1 from public.group_members gm2
    where gm2.group_id = group_members.group_id and gm2.user_id = auth.uid()
  ));

-- el creador del grupo entra como miembro automáticamente
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- ─── group_invites (link de invitación) ───────────────────
create table if not exists public.group_invites (
  code text primary key default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  group_id uuid not null references public.groups(id) on delete cascade,
  group_name text not null,
  group_emoji text not null,
  group_color text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.group_invites enable row level security;

create policy "invites: cualquier autenticado puede ver por code"
  on public.group_invites for select
  using (auth.role() = 'authenticated');

create policy "invites: solo miembros del grupo pueden crear invitaciones"
  on public.group_invites for insert
  with check (exists (
    select 1 from public.group_members gm
    where gm.group_id = group_invites.group_id and gm.user_id = auth.uid()
  ));

create or replace function public.set_invite_group_info()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  select name, emoji, color into new.group_name, new.group_emoji, new.group_color
  from public.groups where id = new.group_id;
  return new;
end;
$$;

drop trigger if exists before_invite_insert on public.group_invites;
create trigger before_invite_insert
  before insert on public.group_invites
  for each row execute function public.set_invite_group_info();

-- función para unirse a un grupo con el código de invitación
create or replace function public.join_group_with_invite(invite_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  target_group_id uuid;
begin
  select group_id into target_group_id from public.group_invites where code = invite_code;
  if target_group_id is null then
    raise exception 'Invitación inválida';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return target_group_id;
end;
$$;

grant execute on function public.join_group_with_invite(text) to authenticated;
