"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, CalendarDays, Check, ChevronLeft, ChevronRight,
  Clock3, History, Home, LogOut, MapPin, Moon, Plus, Sparkles, Sun, UserRound, Users, X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./components/AuthProvider";
import { supabaseEnabled } from "@/lib/supabase";
import { fetchMyGroups, type Group, type Profile } from "@/lib/groups";
import { fetchFriendships } from "@/lib/friends";
import Avatar from "./components/Avatar";
import GroupsView from "./components/GroupsView";
import FriendsView from "./components/FriendsView";
import ProfileView from "./components/ProfileView";
import PlanDetail from "./components/PlanDetail";
import PersonProfileModal from "./components/PersonProfileModal";
import AdminView from "./components/AdminView";
import { createPlan, fetchMyPlans } from "@/lib/plans";
import { fetchNotifications, markNotificationsRead } from "@/lib/notifications";
import { fetchMyProfile, type FullProfile } from "@/lib/profiles";
import { fetchGroupAvailability, fetchAvailability, addAvailabilityBlock, removeAvailabilityBlock, type AvailabilityBlock } from "@/lib/availability";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { cap } from "@/lib/format";

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className="brand" onClick={onClick} aria-label="Ir a Inicio">
      <img src="/planardo-mark-128.png" alt="" className="brand-mark" />
      <span>PLANARDO</span>
    </button>
  );
}

function initialsOf(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const NAV_ITEMS: [string, typeof Home, string][] = [
  ["home", Home, "Inicio"],
  ["calendar", CalendarDays, "Calendario"],
  ["groups", Users, "Grupos"],
  ["friends", UserRound, "Amigos"],
  ["history", History, "Historial"],
];

export default function Page() {
  const { user, signOut } = useAuth();
  const [active, setActive] = useState("home");
  const [modal, setModal] = useState(false);
  const [light, setLight] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [calendarMonth,setCalendarMonth]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
  const [myProfile,setMyProfile]=useState<FullProfile|null>(null);
  const [toast, setToast] = useState(false);
  const [todayBusy, setTodayBusy] = useState<Record<string, { from: Date; until: Date }[]>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState("");
  const [groupToOpen, setGroupToOpen] = useState<string | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [viewingProfileTab, setViewingProfileTab] = useState<"profile"|"calendar"|"chat">("profile");
  const openProfile = useCallback((id:string, tab:"profile"|"calendar"|"chat"="profile")=>{setViewingProfileTab(tab);setViewingProfileId(id)},[]);
  const [plans, setPlans] = useState<any[]>([]);
  const [directFriends, setDirectFriends] = useState<Profile[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [monthAvailability, setMonthAvailability] = useState<AvailabilityBlock[]>([]);
  const [availStatus, setAvailStatus] = useState<"available"|"maybe"|"busy">("busy");
  const [availFrom, setAvailFrom] = useState("");
  const [availTo, setAvailTo] = useState("");
  const [availSaving, setAvailSaving] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  useEffect(() => { if (selectedPlan) window.scrollTo({ top: 0 }); }, [selectedPlan]);
  const [notifications,setNotifications]=useState<any[]>([]);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planCover,setPlanCover]=useState<File>();
  const [planForm, setPlanForm] = useState({
    name:"", emoji:"🎉", date:"", time:"21:00", end_date:"", end_time:"", place_name:"", location_url:"",
    description:"", notes:"", plan_type:"other", color:"#8b5cf6", group_id:"",
  });

  useEffect(() => {
    setLight(getStoredTheme() === "light");
  }, []);
  useEffect(() => {
    applyTheme(light ? "light" : "dark");
  }, [light]);

  const refreshGroups = useCallback(() => {
    if (!supabaseEnabled) {
      setGroupsLoading(false);
      return;
    }
    setGroupsLoading(true);
    fetchMyGroups()
      .then(g => { setGroups(g); setGroupsError(""); })
      .catch((e) => {
        setGroups([]);
        const raw = e as { message?: string; error_description?: string; details?: string; hint?: string; code?: string };
        const msg = raw?.message || raw?.error_description || raw?.details || raw?.hint || JSON.stringify(e);
        setGroupsError(raw?.code ? `[${raw.code}] ${msg}` : msg);
      })
      .finally(() => setGroupsLoading(false));
  }, []);

  useEffect(() => {
    if (user || !supabaseEnabled) refreshGroups();
  }, [user?.id, supabaseEnabled, refreshGroups]);

  useEffect(() => {
    if (user && supabaseEnabled) fetchMyPlans().then(setPlans).catch(()=>setPlans([]));
  }, [user?.id]);
  useEffect(()=>{if(user&&supabaseEnabled)fetchMyProfile().then(setMyProfile).catch(()=>setMyProfile(null))},[user?.id]);
  useEffect(()=>{if(user&&supabaseEnabled)fetchNotifications().then(setNotifications).catch(()=>setNotifications([]))},[user?.id]);
  useEffect(()=>{if(user&&supabaseEnabled)fetchFriendships().then(rows=>setDirectFriends(rows.filter((r:any)=>r.status==="accepted").map((r:any)=>r.person))).catch(()=>setDirectFriends([]))},[user?.id]);

  useEffect(() => {
    if (!groups.length) { setTodayBusy({}); return; }
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const until = new Date(from); until.setDate(until.getDate() + 1);
    Promise.all(groups.map(g => fetchGroupAvailability(g.id, from, until).catch(() => [])))
      .then(results => {
        const map: Record<string, { from: Date; until: Date }[]> = {};
        results.flat().forEach((row: any) => {
          if (!row.busy_from || !row.busy_until) return;
          (map[row.user_id] ||= []).push({ from: new Date(row.busy_from), until: new Date(row.busy_until) });
        });
        setTodayBusy(map);
      });
  }, [groups]);

  const days = useMemo(() => {
    const year=calendarMonth.getFullYear(),month=calendarMonth.getMonth();
    const count=new Date(year,month+1,0).getDate();
    const offset=(new Date(year,month,1).getDay()+6)%7;
    const cells=Math.ceil((offset+count)/7)*7;
    return Array.from({length:cells},(_,i)=>{
      const day=i-offset+1;
      return day>=1&&day<=count?new Date(year,month,day):null;
    });
  },[calendarMonth]);

  const savePlan = async () => {
    if (!planForm.name.trim() || !planForm.date || planSaving) return;
    setPlanSaving(true);
    try {
      const groupMemberIds = planForm.group_id
        ? groups.find(g=>g.id===planForm.group_id)?.members.map(m=>m.id) || []
        : [];
      const invitee_ids = [...new Set([...groupMemberIds, ...picked])];
      await createPlan({ ...planForm, invitee_ids, cover_file:planCover });
      setModal(false); setToast(true);
      setPlanForm({name:"",emoji:"🎉",date:"",time:"21:00",end_date:"",end_time:"",place_name:"",location_url:"",description:"",notes:"",plan_type:"other",color:"#8b5cf6",group_id:""});
      setPicked([]);
      setPlanCover(undefined);
      setPlans(await fetchMyPlans());
      window.setTimeout(() => setToast(false), 3200);
    } finally {
      setPlanSaving(false);
    }
  };

  const rawName = myProfile?.name || (user?.user_metadata?.name as string | undefined) || user?.email?.split("@")[0] || "vos";
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const initials = initialsOf(name);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const todayLabel = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();

  const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  const refreshMonthAvailability = useCallback(() => {
    if (!supabaseEnabled) { setMonthAvailability([]); return; }
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const last = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    fetchAvailability(dateKey(first), dateKey(last)).then(setMonthAvailability).catch(() => setMonthAvailability([]));
  }, [calendarMonth]);
  useEffect(() => { refreshMonthAvailability(); }, [refreshMonthAvailability]);

  const dayAvailability = useMemo(
    () => selectedDay ? monthAvailability.filter(b => b.day === dateKey(selectedDay)) : [],
    [monthAvailability, selectedDay]
  );

  async function addAvail() {
    if (!selectedDay || availSaving) return;
    setAvailSaving(true);
    try {
      // Un solo estado por día: cargar uno nuevo siempre reemplaza los anteriores.
      await Promise.all(dayAvailability.map(b => removeAvailabilityBlock(b.id)));
      await addAvailabilityBlock(dateKey(selectedDay), availStatus, availFrom || undefined, availTo || undefined);
      setAvailFrom(""); setAvailTo("");
      refreshMonthAvailability();
    } finally { setAvailSaving(false); }
  }
  async function removeAvail(id: string) {
    await removeAvailabilityBlock(id);
    refreshMonthAvailability();
  }

  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const plansOnDay = useCallback((day: Date) => {
    const from = dayStart(day), until = new Date(from); until.setDate(until.getDate() + 1);
    return plans.filter((p: any) => {
      const start = new Date(p.starts_at);
      const end = p.ends_at ? new Date(p.ends_at) : start;
      return start < until && end >= from;
    });
  }, [plans]);

  const friends: Profile[] = useMemo(() => {
    const seen = new Map<string, Profile>();
    for (const g of groups) for (const m of g.members) if (m.id !== user?.id) seen.set(m.id, m);
    for (const f of directFriends) seen.set(f.id, f);
    return Array.from(seen.values());
  }, [groups, directFriends, user?.id]);

  const isFreeToday = useCallback((userId: string) => {
    const dayStartToday = new Date(); dayStartToday.setHours(0, 0, 0, 0);
    const dayEndToday = new Date(dayStartToday); dayEndToday.setDate(dayEndToday.getDate() + 1);
    const rows = todayBusy[userId] || [];
    return !rows.some(r => r.from <= dayStartToday && r.until >= dayEndToday);
  }, [todayBusy]);
  const availableToday = useMemo(() => friends.filter(f => isFreeToday(f.id)), [friends, isFreeToday]);
  const upcomingPlans = useMemo(() => plans.filter((p: any) => new Date(p.ends_at || p.starts_at) >= new Date()), [plans]);

  return (
    <main className="app-shell">
      <div className="mesh-bg"><i/><i/><i/><i/></div>
      <aside className="sidebar">
        <Brand onClick={() => { setActive("home"); setSelectedPlan(null); }} />
        <nav>
          {NAV_ITEMS.map(([id, Icon, label]) => (
            <button key={id} className={active === id ? "active" : ""} onClick={() => { setActive(id); setSelectedPlan(null); }}>
              <Icon size={20}/><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile" onClick={() => { setActive("profile"); setSelectedPlan(null); }}><Avatar initials={initials} color="linear-gradient(135deg,#8b5cf6,#ec4899)" src={myProfile?.avatar_url}/><span><b>{name}</b><small>Mi perfil</small></span></button>
          {supabaseEnabled && (
            <button className="profile" onClick={() => signOut()}><span className="signout-icon"><LogOut size={16}/></span><span><b>Salir</b><small>Cerrar sesión</small></span></button>
          )}
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="mobile-brand"><Brand onClick={() => { setActive("home"); setSelectedPlan(null); }}/></div>
          <div className="top-actions">
            <button className="icon-button theme-toggle" onClick={() => setLight(!light)} aria-label="Cambiar tema">{light ? <Moon size={19}/> : <Sun size={19}/>}</button>
            <button className="icon-button notification" aria-label="Notificaciones" onClick={async()=>{
              setNotificationsOpen(!notificationsOpen);
              if(!notificationsOpen){
                await markNotificationsRead().catch(()=>{});
                setNotifications(n=>n.map(x=>({...x,read_at:x.read_at||new Date().toISOString()})));
              }
            }}><Bell size={19}/>{notifications.some(n=>!n.read_at)&&<i/>}</button>
            <button className="top-profile-button" onClick={()=>{setActive("profile");setSelectedPlan(null)}} aria-label="Abrir mi perfil"><Avatar initials={initials} color="linear-gradient(135deg,#8b5cf6,#ec4899)" src={myProfile?.avatar_url}/></button>
          </div>
          <AnimatePresence>{notificationsOpen&&<motion.div className="notifications-panel edge" initial={{opacity:0,y:-6,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-5}}><div className="notifications-head"><div><p className="eyebrow">ACTIVIDAD</p><h3>Notificaciones</h3></div><button onClick={()=>setNotificationsOpen(false)}><X/></button></div>{notifications.length?notifications.map(n=><button className="notification-row" key={n.id} onClick={()=>{if(n.type==="friend_request")setActive("friends");else if(n.plan_id)setSelectedPlan(n.plan_id);else if(n.type==="group_invite_request")setActive("groups");else if((n.type==="group_added"||n.type==="group_message")&&n.group_id){setGroupToOpen(n.group_id);setActive("groups")}else if(n.type==="direct_message"&&n.related_user_id){openProfile(n.related_user_id,"chat")}setNotificationsOpen(false)}}><span>{n.type==="plan_invite"?"🎉":n.type==="plan_updated"?"📝":n.type==="plan_cancelled"?"🚫":n.type==="group_added"?"👥":n.type==="group_invite_request"?"✉️":n.type==="group_message"?"💬":n.type==="direct_message"?"💬":n.type==="friend_accepted"?"🤝":n.type==="attendance"?"✓":n.type==="poll"?"◉":n.type==="location"?"⌖":n.type==="friend_request"?"👋":"•"}</span><div><b>{n.title}</b>{n.body&&<p>{n.body}</p>}<small>{new Date(n.created_at).toLocaleString("es-AR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</small></div></button>):<div className="notifications-empty"><p>Todo tranquilo por acá.</p></div>}</motion.div>}</AnimatePresence>
        </header>

        <div className="page-content">
          {selectedPlan && <PlanDetail id={selectedPlan} onBack={()=>{setSelectedPlan(null);fetchMyPlans().then(setPlans).catch(()=>{});}} onDeleted={()=>fetchMyPlans().then(setPlans).catch(()=>{})} onOpenProfile={openProfile} isAdmin={!!myProfile?.is_admin} friends={directFriends} groups={groups}/>}
          {!selectedPlan && <>
          {active === "home" && (
            <>
              <div className="greeting">
                <div><p className="eyebrow">{todayLabel}</p><h1>{greeting}, {name} <span>👋</span></h1><p>{friends.length > 0 ? "Hay lindos planes esperándote." : "Armá tu primer grupo para arrancar."}</p></div>
              </div>

              {groups.length === 0 && !groupsLoading ? (
                <section className="social-pulse edge">
                  <div className="pulse-copy">
                    <div className="live-label"><i/> PARA ARRANCAR</div>
                    <h2>Todavía no tenés<br/>ningún <span>grupo</span> <b>👥</b></h2>
                    <p>Creá un grupo y compartí el link para que se sumen con su cuenta.</p>
                    {groupsError && <p className="groups-fetch-error">No pudimos traer tus grupos: {groupsError}</p>}
                    <div className="pulse-actions">
                      <button className="pulse-cta" onClick={() => setActive("groups")}><Plus size={18}/> Crear mi primer grupo</button>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="social-pulse edge">
                  <div className="pulse-copy">
                    <div className="live-label"><i/> {availableToday.length > 0 ? `${availableToday.length} LIBRES HOY` : "TU GENTE"}</div>
                    <h2>Tenés <span>{directFriends.length}</span> {directFriends.length === 1 ? "amiga/o" : "amigas/os"}<br/>y estás en <span>{groups.length}</span> {groups.length === 1 ? "grupo" : "grupos"}</h2>
                    <p>Elegí un grupo y armá un plan, o invitá a alguien más.</p>
                    <div className="pulse-actions">
                      <button className="pulse-cta" onClick={() => setModal(true)}><Plus size={18}/> Armar un Planardo</button>
                      <button className="pulse-secondary" onClick={() => setActive("groups")}>Ver grupos <ChevronRight size={17}/></button>
                    </div>
                  </div>
                  <div className="people-orbit">
                    <div className="orbit-ring ring-one"/>
                    <div className="orbit-ring ring-two"/>
                    {friends.slice(0, 4).map((person, index) => (
                      <motion.div
                        className={`orbit-person person-${index + 1}`}
                        key={person.id}
                        initial={{ opacity: 0, scale: .7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: .12 * index, type: "spring" }}
                      >
                        <Avatar initials={initialsOf(person.name)} color={person.avatar_color} src={person.avatar_url}/>
                        <span>{person.name}</span>
                        {isFreeToday(person.id) && <i title="Libre hoy"/>}
                      </motion.div>
                    ))}
                    <div className="orbit-center"><span>{availableToday.length}</span><small>libres hoy</small></div>
                  </div>
                </section>
              )}

              <section className="week-social">
                <div className="section-title">
                  <div><h2>Tus grupos</h2><p>Un vistazo rápido — el detalle está en la pestaña Grupos</p></div>
                  <button className="see-all" onClick={() => { setGroupToOpen(null); setActive("groups"); }}>Ver todos <ChevronRight size={16}/></button>
                </div>
                <div className="social-days">
                  {groups.slice(0, 5).map((g) => (
                    <button key={g.id} className="social-day edge" onClick={() => { setGroupToOpen(g.id); setActive("groups"); }}>
                      <span className="social-date"><b style={{ fontSize: 22 }}>{g.emoji}</b></span>
                      <span className="social-people">
                        {g.members.slice(0, 4).map((m) => <Avatar key={m.id} initials={initialsOf(m.name)} color={m.avatar_color} src={m.avatar_url} small/>)}
                      </span>
                      <span className="social-count"><i/>{g.name}</span>
                    </button>
                  ))}
                  {groups.length === 0 && !groupsLoading && (
                    <button className="social-day edge" onClick={() => { setGroupToOpen(null); setActive("groups"); }}>
                      <span className="social-count">+ Crear grupo</span>
                    </button>
                  )}
                </div>
              </section>
              <section className="upcoming">
                <div className="section-title"><div><h2>Próximos Planardos</h2><p>Planes reales de tus grupos</p></div></div>
                {upcomingPlans.length ? <div className="event-track">{upcomingPlans.slice(0,3).map((plan:any)=>{
                  const date=new Date(plan.starts_at);
                  return <article className="event-card" onClick={()=>setSelectedPlan(plan.id)} key={plan.id} style={plan.cover_url?{backgroundImage:`linear-gradient(180deg,rgba(10,8,16,.2),rgba(10,8,16,.8)),url(${plan.cover_url})`,backgroundSize:"cover",backgroundPosition:"center"}:{background:`linear-gradient(145deg,${plan.color},#21152f)`}}>
                    <div className="event-top"><span className="event-emoji">{plan.emoji}</span><span className={`event-status ${plan.my_response}`}><i/> {plan.my_response==="going"?"Voy":plan.my_response==="maybe"?"Tal vez":plan.my_response==="declined"?"No puedo":"Pendiente"}</span></div>
                    <div className="event-main"><p>{date.toLocaleDateString("es-AR",{weekday:"long",day:"numeric"}).toUpperCase()} · {date.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</p><h3>{plan.name}</h3>{plan.place_name&&<div className="place"><MapPin size={17}/>{plan.place_name}</div>}</div>
                    <div className="event-bottom"><span className="people-count">{plan.plan_members?.length || 1} invitados</span><button><ChevronRight/></button></div>
                  </article>
                })}</div>:<button className="plans-empty edge" onClick={()=>setModal(true)}><span>✨</span><div><b>Tu próximo Planardo empieza acá</b><small>Crealo e invitá a uno de tus grupos.</small></div><Plus/></button>}
              </section>
            </>
          )}

          {active === "calendar" && (
            <>
              <div className="greeting">
                <div><p className="eyebrow">TU AGENDA</p><h1>Tu calendario</h1><p>Todos tus Planardos, sean de un grupo o de a dos. La disponibilidad de cada grupo está dentro de ese grupo.</p></div>
              </div>
              <section className="calendar-section">
                <div className="calendar-card edge">
                  <div className="calendar-header">
                    <div><p className="eyebrow">{cap(calendarMonth.toLocaleDateString("es-AR",{month:"long"}))}</p><h2>{calendarMonth.getFullYear()}</h2></div>
                    <div className="calendar-nav"><button onClick={()=>setCalendarMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}><ChevronLeft/></button><button onClick={()=>setCalendarMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}><ChevronRight/></button></div>
                  </div>
                  <div className="weekdays">{["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"].map(d=><span key={d}>{d}</span>)}</div>
                  <div className="calendar-grid">
                    {days.map((day,i) => {
                      if (day === null) return <div className="day muted" key={i}/>;
                      const dayPlans = plansOnDay(day);
                      const dayBlocks = monthAvailability.filter(b => b.day === dateKey(day));
                      const dayIsBusy = dayBlocks.some(b => b.status === "busy");
                      return (
                        <button key={i} onClick={() => setSelectedDay(day)} className={`day ${selectedDay?.toDateString()===day.toDateString()?"selected":""} ${day.toDateString()===new Date().toDateString()?"today":""} ${dayIsBusy?"day-busy":""}`}>
                          <span className="day-number">{day.getDate()}</span>
                          {dayPlans.length > 0 && <span className="day-dots">{dayPlans.slice(0,3).map((p:any)=><i key={p.id} style={{background:p.color}}/>)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <aside className="day-detail edge">
                  {selectedDay ? (
                    <>
                      <div className="day-detail-head"><div><p className="eyebrow">{cap(selectedDay.toLocaleDateString("es-AR",{weekday:"long"}))}</p><h3>{cap(selectedDay.toLocaleDateString("es-AR",{day:"numeric",month:"long"}))}</h3></div><button onClick={() => setSelectedDay(null)}><X size={18}/></button></div>
                      {plansOnDay(selectedDay).length ? (
                        <div className="day-plan-list">
                          {plansOnDay(selectedDay).map((p:any)=>(
                            <button key={p.id} className="day-plan-row" onClick={()=>setSelectedPlan(p.id)}>
                              <span className="day-plan-emoji" style={{background:p.color}}>{p.emoji}</span>
                              <span><b>{p.name}</b><small>{new Date(p.starts_at).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}{p.place_name?` · ${p.place_name}`:""}</small></span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="availability-note">No tenés planes este día.</p>
                      )}
                      <div className="day-avail-block">
                        <p className="eyebrow">TU DISPONIBILIDAD</p>
                        {dayAvailability.length > 0 && (
                          <div className="day-avail-chips">
                            {dayAvailability.map(b => (
                              <span key={b.id} className={`avail-chip ${b.status}`}>
                                {b.status === "busy" ? "Ocupado" : b.status === "maybe" ? "Tal vez" : "Libre"}
                                {b.time_from ? ` ${b.time_from.slice(0,5)}–${b.time_to?.slice(0,5) || "23:59"}` : " todo el día"}
                                <button onClick={() => removeAvail(b.id)} aria-label="Quitar"><X size={11}/></button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="day-avail-form">
                          <select value={availStatus} onChange={e=>setAvailStatus(e.target.value as any)}>
                            <option value="busy">🔴 Ocupado</option>
                            <option value="maybe">🟡 Tal vez</option>
                            <option value="available">🟢 Libre</option>
                          </select>
                          <div className="day-avail-times">
                            <input type="time" value={availFrom} onChange={e=>setAvailFrom(e.target.value)} aria-label="Desde"/>
                            <span>a</span>
                            <input type="time" value={availTo} onChange={e=>setAvailTo(e.target.value)} aria-label="Hasta"/>
                            <button className="day-avail-add" onClick={addAvail} disabled={availSaving}><Plus size={15}/></button>
                          </div>
                        </div>
                        <p className="availability-note">Dejá el horario vacío para marcar el día completo. Solo se guarda un estado por día.</p>
                      </div>
                    </>
                  ) : (
                    <p className="availability-note">Tocá un día del calendario para ver tus planes.</p>
                  )}
                </aside>
              </section>
            </>
          )}

          {active === "groups" && (
            <GroupsView groups={groups} loading={groupsLoading} onRefresh={refreshGroups} initialOpenGroupId={groupToOpen} plans={plans} onSelectPlan={setSelectedPlan} onOpenProfile={openProfile} friends={directFriends} isAdmin={!!myProfile?.is_admin} />
          )}

          {active === "friends" && <FriendsView onOpenProfile={openProfile} />}

          {active === "history" && <>
            <div className="greeting"><div><p className="eyebrow">RECUERDOS</p><h1>Historial</h1><p>Los planes terminan; las historias quedan.</p></div></div>
            {plans.filter(p=>p.status==="completed"||new Date(p.starts_at)<new Date()).length?<div className="history-grid">{plans.filter(p=>p.status==="completed"||new Date(p.starts_at)<new Date()).map(p=><button className="history-card edge" key={p.id} onClick={()=>setSelectedPlan(p.id)}><span style={{background:p.color}}>{p.emoji}</span><div><time>{new Date(p.starts_at).toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"})}</time><h3>{p.name}</h3><p>{p.place_name||"Sin ubicación"}</p></div><ChevronRight/></button>)}</div>:<div className="empty-state edge"><span className="empty-emoji">📸</span><h3>Todavía no hay recuerdos</h3><p>Cuando termine un Planardo aparecerá acá con sus fotos, asistentes y comentarios.</p></div>}
          </>}

          {active === "profile" && (
            <ProfileView fallbackName={name} email={user?.email} groupCount={groups.length} friendCount={directFriends.length} onChanged={setMyProfile} isAdmin={!!myProfile?.is_admin} onOpenAdmin={()=>setActive("admin")}/>
          )}
          {active === "admin" && myProfile?.is_admin && <AdminView/>}
          </>}
        </div>
      </section>

      <button className="fab" onClick={()=>setModal(true)} aria-label="Crear Planardo"><Plus/></button>
      <nav className="bottom-nav">
        {NAV_ITEMS.map(([id,Icon,label])=><button key={id} className={active===id?"active":""} onClick={()=>{setActive(id);setSelectedPlan(null)}}><Icon size={20}/><span>{label}</span></button>)}
      </nav>

      <AnimatePresence>
        {modal && <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={(e)=>e.target===e.currentTarget&&setModal(false)}>
          <motion.div className="modal edge" initial={{opacity:0,y:30,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:30,scale:.97}} transition={{type:"spring",damping:26,stiffness:300}}>
            <div className="modal-handle"/>
            <div className="modal-head"><div><p className="eyebrow">NUEVO PLAN</p><h2>Crear un Planardo <span>✨</span></h2></div><button onClick={()=>setModal(false)}><X/></button></div>
            <div className="form">
              <label className="main-input"><span className="emoji-picker">{planForm.emoji}</span><input autoFocus placeholder="¿Qué plan pinta?" value={planForm.name} onChange={e=>setPlanForm({...planForm,name:e.target.value})}/></label>
              <div className="color-select emoji-select"><span>Emoji</span><div>{["🎉","🥩","🎂","✈️","🎮","🍽️","🏠","⚽","🎬","🍻","📚","🏖️","🎊","🌮","☕","🎵"].map(e=><button type="button" key={e} className={planForm.emoji===e?"selected emoji-opt":"emoji-opt"} onClick={()=>setPlanForm({...planForm,emoji:e})}>{e}</button>)}</div></div>
              <div className="field-row">
                <label><span><CalendarDays size={17}/> Fecha</span><input type="date" value={planForm.date} onChange={e=>setPlanForm({...planForm,date:e.target.value})}/></label>
                <label><span><Clock3 size={17}/> Hora</span><input type="time" value={planForm.time} onChange={e=>setPlanForm({...planForm,time:e.target.value})}/></label>
              </div>
              <div className="field-row">
                <label><span><CalendarDays size={17}/> Finaliza (opcional)</span><input type="date" min={planForm.date} value={planForm.end_date} onChange={e=>setPlanForm({...planForm,end_date:e.target.value})}/></label>
                <label><span><Clock3 size={17}/> Hora final</span><input type="time" value={planForm.end_time} onChange={e=>setPlanForm({...planForm,end_time:e.target.value})}/></label>
              </div>
              {planForm.date&&planForm.end_date&&<p className="duration-hint">{Math.max(1,Math.round((new Date(planForm.end_date).getTime()-new Date(planForm.date).getTime())/86400000)+1)} días · {Math.max(0,Math.round((new Date(planForm.end_date).getTime()-new Date(planForm.date).getTime())/86400000))} noches</p>}
              <label className="field"><span><Sparkles size={17}/> Tipo de plan</span><select value={planForm.plan_type} onChange={e=>setPlanForm({...planForm,plan_type:e.target.value})}>{[["food","🍕 Cena / comida"],["home","🏠 Casa"],["camping","🏕️ Camping"],["trip","✈️ Viaje"],["birthday","🎂 Cumpleaños"],["bar","🍻 Bar"],["cinema","🎬 Cine"],["outdoor","🏖️ Aire libre"],["sport","🏃 Deporte"],["gaming","🎮 Gaming"],["study","📚 Estudio"],["party","🎉 Fiesta"],["other","✨ Otro"]].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
              <label className="field"><span><MapPin size={17}/> Lugar</span><input placeholder="¿Dónde se juntan?" value={planForm.place_name} onChange={e=>setPlanForm({...planForm,place_name:e.target.value})}/></label>
              <label className="field"><span><MapPin size={17}/> Link de ubicación</span><input type="text" inputMode="url" placeholder="https://maps.google.com/…" value={planForm.location_url} onChange={e=>setPlanForm({...planForm,location_url:e.target.value})}/></label>
              <label className="field"><span>Descripción</span><input placeholder="Contales de qué se trata" value={planForm.description} onChange={e=>setPlanForm({...planForm,description:e.target.value})}/></label>
              <label className="field"><span>Foto de portada (opcional)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setPlanCover(e.target.files?.[0])}/></label>
              <label className="field"><span><Users size={17}/> Grupo (opcional)</span><select value={planForm.group_id} onChange={e=>setPlanForm({...planForm,group_id:e.target.value})}><option value="">Sin grupo — elijo yo a quién invitar</option>{groups.map(g=><option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}</select></label>
              <label className="field">
                <span><Users size={17}/> {planForm.group_id?"Además, invitar a":"Invitados"}</span>
                {friends.length > 0 ? (
                  <div className="invitee-picker">
                    {friends.map(p=>{
                      const on = picked.includes(p.id);
                      return <button type="button" key={p.id} className={`invitee-chip ${on?"on":""}`} onClick={()=>setPicked(list=>on?list.filter(id=>id!==p.id):[...list,p.id])}>
                        <Avatar initials={initialsOf(p.name)} color={p.avatar_color} src={p.avatar_url} small/><span>{p.name}</span>{on&&<Check size={13}/>}
                      </button>;
                    })}
                  </div>
                ) : (
                  <p style={{fontSize:11,color:"var(--muted)",margin:0}}>Todavía no tenés amigos agregados. <button type="button" className="auth-link" onClick={()=>{setModal(false);setActive("friends");}}>Agregá amigos</button></p>
                )}
              </label>
              <div className="color-select"><span>Color del plan</span><div>{["#8b5cf6","#f97316","#06b6d4","#22c55e","#ec4899"].map(c=><button type="button" key={c} onClick={()=>setPlanForm({...planForm,color:c})} className={planForm.color===c?"selected":""} style={{background:c}}>{planForm.color===c&&<Check/>}</button>)}</div></div>
              <button className="create-submit" disabled={planSaving||!planForm.name||!planForm.date} onClick={savePlan}>{planSaving?"Creando…":"Crear Planardo ✨"}</button>
              <p className="form-note">Podés cambiar todos los detalles después</p>
            </div>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
      <AnimatePresence>{toast&&<motion.div className="toast" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}}><span><Check/></span><div><b>¡Planardo creado!</b><p>Ahora invitá a tus amigos</p></div></motion.div>}</AnimatePresence>
      <PersonProfileModal id={viewingProfileId} onClose={() => { setViewingProfileId(null); setViewingProfileTab("profile"); }} isFriend={!!viewingProfileId && directFriends.some(f=>f.id===viewingProfileId)} initialTab={viewingProfileTab} />
    </main>
  );
}
