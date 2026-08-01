-- Compartir un Planardo puntual por link (no solo grupos). Igual mecánica
-- que group_invites: el código es el secreto de acceso, por eso el preview
-- público solo expone nombre/emoji/color, no quién participa.
set role postgres;

create table if not exists public.plan_invites (
  code text primary key default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  plan_id uuid not null references public.plans(id) on delete cascade,
  plan_name text not null,
  plan_emoji text not null,
  plan_color text not null,
  plan_group_id uuid references public.groups(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.plan_invites enable row level security;

create policy "plan invites: miembros del plan ven"
  on public.plan_invites for select
  using (public.is_plan_member(plan_id));

create policy "plan invites: preview público por código"
  on public.plan_invites for select
  to anon
  using (true);

create or replace function public.create_plan_invite(target_plan uuid)
returns public.plan_invites
language plpgsql security definer set search_path = public
as $$
declare inv plan_invites; p record;
begin
  if not public.is_plan_member(target_plan) then raise exception 'No pertenecés a este plan'; end if;
  select name, emoji, color, group_id into p from plans where id = target_plan;
  insert into plan_invites(plan_id, plan_name, plan_emoji, plan_color, plan_group_id, created_by)
  values (target_plan, p.name, p.emoji, p.color, p.group_id, auth.uid())
  returning * into inv;
  return inv;
end $$;
revoke all on function public.create_plan_invite(uuid) from public;
grant execute on function public.create_plan_invite(uuid) to authenticated;

create or replace function public.join_plan_with_invite(invite_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare target_plan uuid;
begin
  select plan_id into target_plan from plan_invites where code = invite_code;
  if target_plan is null then raise exception 'Invitación inválida'; end if;
  insert into plan_members(plan_id, user_id) values (target_plan, auth.uid())
  on conflict (plan_id, user_id) do nothing;
  return target_plan;
end $$;
revoke all on function public.join_plan_with_invite(text) from public;
grant execute on function public.join_plan_with_invite(text) to authenticated;
