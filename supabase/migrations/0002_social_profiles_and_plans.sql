-- PLANARDO: identidad social, amistades y modelo completo de planes.
-- Ejecutar después de 0001_groups.sql.

set role postgres;

-- Perfil público único + foto.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;

update public.profiles
set username = lower(regexp_replace(name, '[^a-zA-Z0-9_]', '', 'g')) || '_' || substr(id::text, 1, 5)
where username is null;

alter table public.profiles alter column username set not null;
create unique index if not exists profiles_username_unique on public.profiles (lower(username));
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,24}$') not valid;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
begin
  base_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    '[^a-zA-Z0-9_]', '', 'g'
  ));
  if char_length(base_username) < 3 then base_username := 'user'; end if;
  insert into public.profiles (id, name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data->>'username' is not null then left(base_username, 24)
      else left(base_username, 18) || '_' || substr(new.id::text, 1, 5)
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists "profiles: el dueño puede actualizar el suyo" on public.profiles;
create policy "profiles: el dueño puede actualizar el suyo"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

create policy "avatars: lectura pública" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars: cada usuario sube la suya" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: cada usuario actualiza la suya" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Evita recursión RLS al consultar miembros.
create or replace function public.is_group_member(target_group uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from group_members where group_id = target_group and user_id = auth.uid()) $$;

drop policy if exists "groups: los miembros ven sus grupos" on public.groups;
create policy "groups: los miembros ven sus grupos" on public.groups for select
  using (public.is_group_member(id));
drop policy if exists "group_members: los miembros ven la lista de su grupo" on public.group_members;
create policy "group_members: los miembros ven la lista de su grupo" on public.group_members for select
  using (public.is_group_member(group_id));
alter table public.groups add column if not exists description text;
alter table public.groups add column if not exists photo_url text;
create policy "groups: creador actualiza" on public.groups for update
  using(created_by=auth.uid()) with check(created_by=auth.uid());
alter table public.group_members drop constraint if exists group_members_role_check;
alter table public.group_members add constraint group_members_role_check check(role in ('owner','moderator','member'));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('plan-media','plan-media',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true;
create policy "plan-media: lectura pública" on storage.objects for select using(bucket_id='plan-media');
create policy "plan-media: autenticados suben" on storage.objects for insert
  with check(bucket_id='plan-media' and auth.role()='authenticated');

-- Amistades individuales, aunque no compartan grupo.
create table if not exists public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
alter table public.friendships enable row level security;
create policy "friendships: involucrados pueden ver" on public.friendships for select
  using (auth.uid() in (requester_id, addressee_id));
create policy "friendships: enviar solicitud" on public.friendships for insert
  with check (auth.uid() = requester_id);
create policy "friendships: destinatario responde" on public.friendships for update
  using (auth.uid() = addressee_id or auth.uid() = requester_id);
create policy "friendships: involucrados eliminan" on public.friendships for delete
  using (auth.uid() in (requester_id, addressee_id));

-- Planes.
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  emoji text not null default '🎉',
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  place_name text,
  place_address text,
  latitude double precision,
  longitude double precision,
  color text not null default '#8b5cf6',
  cover_url text,
  status text not null default 'active' check (status in ('draft','active','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.plans add column if not exists plan_type text not null default 'other';
alter table public.plans add column if not exists location_url text;
alter table public.plans add column if not exists notes text;

create table if not exists public.plan_members (
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response text not null default 'pending' check (response in ('pending','going','maybe','declined')),
  role text not null default 'guest' check (role in ('host','cohost','guest')),
  responded_at timestamptz,
  attended boolean,
  primary key (plan_id, user_id)
);

create or replace function public.is_plan_member(target_plan uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from plan_members where plan_id = target_plan and user_id = auth.uid()) $$;

alter table public.plans enable row level security;
alter table public.plan_members enable row level security;
create policy "plans: invitados pueden ver" on public.plans for select
  using (created_by = auth.uid() or public.is_plan_member(id));
create policy "plans: usuarios crean" on public.plans for insert with check (created_by = auth.uid());
create policy "plans: host actualiza" on public.plans for update using (created_by = auth.uid());
create policy "plan_members: miembros ven" on public.plan_members for select using (public.is_plan_member(plan_id));
create policy "plan_members: host invita" on public.plan_members for insert
  with check (exists(select 1 from public.plans p where p.id = plan_id and p.created_by = auth.uid()) or user_id = auth.uid());
create policy "plan_members: usuario responde" on public.plan_members for update using (user_id = auth.uid());

create or replace function public.handle_new_plan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into plan_members(plan_id,user_id,response,role,responded_at)
  values(new.id,new.created_by,'going','host',now()) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_plan_created on public.plans;
create trigger on_plan_created after insert on public.plans for each row execute function public.handle_new_plan();

-- Disponibilidad.
create table if not exists public.availability (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  status text not null check (status in ('available','maybe','busy')),
  note text,
  primary key (user_id, day)
);
alter table public.availability enable row level security;
create policy "availability: autenticados ven" on public.availability for select using (auth.role()='authenticated');
create policy "availability: propia" on public.availability for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- Votaciones, responsabilidades y chat.
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.plans(id) on delete cascade,
  question text not null, multiple boolean not null default false, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(), poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null, emoji text, position int not null default 0
);
create table if not exists public.poll_votes (
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now(),
  primary key(option_id,user_id)
);
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.plans(id) on delete cascade,
  label text not null, claimed_by uuid references public.profiles(id) on delete set null, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.plan_messages (
  id bigint generated always as identity primary key, plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, body text, media_url text, gif_url text,
  reply_to bigint references public.plan_messages(id) on delete set null, created_at timestamptz not null default now(),
  check (body is not null or media_url is not null or gif_url is not null)
);
create table if not exists public.message_reactions (
  message_id bigint not null references public.plan_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, emoji text not null,
  primary key(message_id,user_id,emoji)
);

create table if not exists public.plan_checklist (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.plans(id) on delete cascade,
  label text not null, completed boolean not null default false, completed_by uuid references public.profiles(id),
  position int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.plan_timeline (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.plans(id) on delete cascade,
  title text not null, starts_at timestamptz not null, place_name text, notes text, position int not null default 0
);
create table if not exists public.plan_expenses (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.plans(id) on delete cascade,
  label text not null, amount numeric(12,2) not null check(amount >= 0), paid_by uuid references public.profiles(id),
  split_equally boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.plan_payments (
  expense_id uuid not null references public.plan_expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null default 0, paid boolean not null default false,
  primary key(expense_id,user_id)
);
create table if not exists public.plan_transport (
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check(mode in ('car','rideshare','walk','bus','bike','other')),
  seats_available int not null default 0 check(seats_available >= 0), note text,
  primary key(plan_id,user_id)
);
create table if not exists public.plan_photos (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.plans(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id), url text not null, caption text, created_at timestamptz not null default now()
);
create table if not exists public.plan_comments (
  id bigint generated always as identity primary key, plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id), body text not null, created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id bigint generated always as identity primary key, user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, title text not null, body text, plan_id uuid references public.plans(id) on delete cascade,
  read_at timestamptz, created_at timestamptz not null default now()
);
create or replace function public.notify_friend_request()
returns trigger language plpgsql security definer set search_path=public as $$
declare requester_name text;
begin
  select name into requester_name from profiles where id=new.requester_id;
  insert into notifications(user_id,type,title,body)
  values(new.addressee_id,'friend_request',requester_name || ' quiere ser tu amigo/a','Tocá para responder la solicitud.');
  return new;
end $$;
drop trigger if exists on_friend_request_created on public.friendships;
create trigger on_friend_request_created after insert on public.friendships
for each row execute function public.notify_friend_request();
create table if not exists public.plan_templates (
  id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id) on delete cascade,
  name text not null, emoji text not null, plan_type text not null, defaults jsonb not null default '{}'::jsonb,
  is_system boolean not null default false, created_at timestamptz not null default now()
);

alter table public.plan_checklist enable row level security;
alter table public.plan_timeline enable row level security;
alter table public.plan_expenses enable row level security;
alter table public.plan_payments enable row level security;
alter table public.plan_transport enable row level security;
alter table public.plan_photos enable row level security;
alter table public.plan_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.plan_templates enable row level security;
create policy "checklist: miembros gestionan" on public.plan_checklist for all using(public.is_plan_member(plan_id)) with check(public.is_plan_member(plan_id));
create policy "timeline: miembros gestionan" on public.plan_timeline for all using(public.is_plan_member(plan_id)) with check(public.is_plan_member(plan_id));
create policy "expenses: miembros gestionan" on public.plan_expenses for all using(public.is_plan_member(plan_id)) with check(public.is_plan_member(plan_id));
create policy "payments: miembros ven" on public.plan_payments for select using(exists(select 1 from plan_expenses e where e.id=expense_id and public.is_plan_member(e.plan_id)));
create policy "transport: miembros gestionan propio" on public.plan_transport for all using(user_id=auth.uid()) with check(user_id=auth.uid() and public.is_plan_member(plan_id));
create policy "photos: miembros gestionan" on public.plan_photos for all using(public.is_plan_member(plan_id)) with check(public.is_plan_member(plan_id) and uploaded_by=auth.uid());
create policy "comments: miembros gestionan" on public.plan_comments for all using(public.is_plan_member(plan_id)) with check(public.is_plan_member(plan_id) and user_id=auth.uid());
create policy "notifications: propias" on public.notifications for select using(user_id=auth.uid());
create policy "notifications: marcar propias" on public.notifications for update using(user_id=auth.uid());
create policy "templates: sistema o propias" on public.plan_templates for select using(is_system or owner_id=auth.uid());
create policy "templates: crear propias" on public.plan_templates for insert with check(owner_id=auth.uid() and not is_system);

insert into public.plan_templates(name,emoji,plan_type,defaults,is_system)
select * from (values
  ('Asado','🥩','food','{"checklist":["Comprar carbón","Comprar hielo"],"poll":"¿Qué comemos?"}'::jsonb,true),
  ('Cumpleaños','🎂','birthday','{"checklist":["Confirmar invitados","Comprar torta"],"sections":["food","drinks","budget"]}'::jsonb,true),
  ('Viaje','✈️','trip','{"sections":["timeline","budget","transport","checklist"],"multi_day":true}'::jsonb,true),
  ('Noche de juegos','🎮','gaming','{"poll":"¿Qué jugamos?","sections":["food","drinks"]}'::jsonb,true),
  ('Cena','🍽️','food','{"poll":"¿Dónde cenamos?","sections":["food","budget"]}'::jsonb,true)
) as seed(name,emoji,plan_type,defaults,is_system)
where not exists(select 1 from public.plan_templates where is_system and plan_templates.name=seed.name);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.plan_items enable row level security;
alter table public.plan_messages enable row level security;
alter table public.message_reactions enable row level security;

create policy "polls: miembros" on public.polls for select using (public.is_plan_member(plan_id));
create policy "polls: miembros crean" on public.polls for insert with check (public.is_plan_member(plan_id) and created_by=auth.uid());
create policy "options: miembros ven" on public.poll_options for select using (exists(select 1 from polls p where p.id=poll_id and public.is_plan_member(p.plan_id)));
create policy "options: miembros crean" on public.poll_options for insert with check (exists(select 1 from polls p where p.id=poll_id and public.is_plan_member(p.plan_id)));
create policy "votes: miembros ven" on public.poll_votes for select using (exists(select 1 from poll_options o join polls p on p.id=o.poll_id where o.id=option_id and public.is_plan_member(p.plan_id)));
create policy "votes: propio" on public.poll_votes for insert with check (user_id=auth.uid());
create policy "items: miembros ven" on public.plan_items for select using (public.is_plan_member(plan_id));
create policy "items: miembros crean" on public.plan_items for insert with check (public.is_plan_member(plan_id) and created_by=auth.uid());
create policy "items: miembros actualizan" on public.plan_items for update using (public.is_plan_member(plan_id));
create policy "messages: miembros ven" on public.plan_messages for select using (public.is_plan_member(plan_id));
create policy "messages: miembros envían" on public.plan_messages for insert with check (public.is_plan_member(plan_id) and user_id=auth.uid());
create policy "reactions: miembros ven" on public.message_reactions for select using (exists(select 1 from plan_messages m where m.id=message_id and public.is_plan_member(m.plan_id)));
create policy "reactions: propias" on public.message_reactions for insert with check (user_id=auth.uid());

alter publication supabase_realtime add table public.group_members;
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.plan_members;
alter publication supabase_realtime add table public.plan_messages;
