-- ⚠️ Borra TODOS los grupos, planes, invitaciones, amistades, disponibilidad
-- y notificaciones de TODOS los usuarios. No borra las cuentas (auth.users)
-- ni los perfiles (nombre/username/foto) — arranca la app "vacía" pero
-- todos siguen pudiendo loguearse igual.
-- No es un archivo de migración normal, correr SOLO si hace falta resetear.
set role postgres;

truncate table
  public.group_invites,
  public.group_members,
  public.groups,
  public.friendships,
  public.notifications,
  public.availability,
  public.message_reactions,
  public.plan_checklist,
  public.plan_comments,
  public.plan_expenses,
  public.plan_items,
  public.plan_members,
  public.plan_messages,
  public.plan_payments,
  public.plan_photos,
  public.plan_timeline,
  public.plan_transport,
  public.poll_options,
  public.poll_votes,
  public.polls,
  public.plans
cascade;
