-- Encuestas atómicas: nunca se guarda una pregunta sin sus opciones.
set role postgres;

delete from public.polls p
where not exists(select 1 from public.poll_options o where o.poll_id=p.id);

create or replace function public.create_poll(
  target_plan uuid, poll_question text, option_labels text[]
)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare new_poll uuid; clean_options text[];
begin
  if not public.is_plan_member(target_plan) then raise exception 'No pertenecés a este Planardo'; end if;
  select array_agg(trim(value)) into clean_options
  from unnest(option_labels) as options(value) where nullif(trim(value),'') is not null;
  if nullif(trim(poll_question),'') is null then raise exception 'Escribí una pregunta'; end if;
  if coalesce(array_length(clean_options,1),0)<2 then raise exception 'Agregá al menos dos opciones'; end if;

  insert into polls(plan_id,question,created_by)
  values(target_plan,trim(poll_question),auth.uid()) returning id into new_poll;
  insert into poll_options(poll_id,label,position)
  select new_poll,value,ordinality-1
  from unnest(clean_options) with ordinality as options(value,ordinality);
  return new_poll;
end $$;

create or replace function public.vote_poll(target_option uuid)
returns boolean
language plpgsql security definer set search_path=public
as $$
declare target_poll uuid; target_plan uuid;
begin
  select o.poll_id,p.plan_id into target_poll,target_plan
  from poll_options o join polls p on p.id=o.poll_id where o.id=target_option;
  if target_poll is null or not public.is_plan_member(target_plan) then raise exception 'Encuesta inválida'; end if;
  delete from poll_votes v using poll_options o
  where v.option_id=o.id and o.poll_id=target_poll and v.user_id=auth.uid();
  insert into poll_votes(option_id,user_id) values(target_option,auth.uid());
  return true;
end $$;

create or replace function public.delete_poll(target_poll uuid)
returns boolean
language plpgsql security definer set search_path=public
as $$
begin
  if not exists(
    select 1 from polls po join plans p on p.id=po.plan_id
    where po.id=target_poll and (po.created_by=auth.uid() or p.created_by=auth.uid())
  ) then raise exception 'No podés eliminar esta encuesta'; end if;
  delete from polls where id=target_poll;
  return found;
end $$;

revoke all on function public.create_poll(uuid,text,text[]) from public;
revoke all on function public.vote_poll(uuid) from public;
revoke all on function public.delete_poll(uuid) from public;
grant execute on function public.create_poll(uuid,text,text[]) to authenticated;
grant execute on function public.vote_poll(uuid) to authenticated;
grant execute on function public.delete_poll(uuid) to authenticated;
