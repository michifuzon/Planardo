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
import Avatar from "./components/Avatar";
import GroupsView from "./components/GroupsView";
import FriendsView from "./components/FriendsView";
import ProfileView from "./components/ProfileView";
import PlanDetail from "./components/PlanDetail";
import AvailabilityView from "./components/AvailabilityView";
import { createPlan, fetchMyPlans } from "@/lib/plans";
import { fetchNotifications, markNotificationsRead } from "@/lib/notifications";
import { fetchMyProfile, type FullProfile } from "@/lib/profiles";

function Brand() {
  return (
    <div className="brand">
      <img src="/planardo-mark-128.png" alt="" className="brand-mark" />
      <span>PLANARDO</span>
    </div>
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [notifications,setNotifications]=useState<any[]>([]);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planCover,setPlanCover]=useState<File>();
  const [planCreationKey,setPlanCreationKey]=useState(()=>crypto.randomUUID());
  const [planForm, setPlanForm] = useState({
    name:"", emoji:"🎉", date:"", time:"21:00", end_date:"", end_time:"", place_name:"", location_url:"",
    description:"", notes:"", plan_type:"other", color:"#8b5cf6", group_id:"",
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
  }, [light]);

  const refreshGroups = useCallback(() => {
    if (!supabaseEnabled) {
      setGroupsLoading(false);
      return;
    }
    setGroupsLoading(true);
    fetchMyGroups()
      .then(setGroups)
      .catch((error) => console.error("No se pudieron cargar los grupos:", error))
      .finally(() => setGroupsLoading(false));
  }, []);

  useEffect(() => {
    if (user || !supabaseEnabled) refreshGroups();
  }, [user, refreshGroups]);

  useEffect(() => {
    if (user && supabaseEnabled) fetchMyPlans().then(setPlans).catch(()=>setPlans([]));
  }, [user]);
  useEffect(()=>{if(user&&supabaseEnabled)fetchMyProfile().then(setMyProfile).catch(()=>setMyProfile(null))},[user]);
  useEffect(()=>{if(user&&supabaseEnabled)fetchNotifications().then(setNotifications).catch(()=>setNotifications([]))},[user]);

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
      const invitee_ids = planForm.group_id
        ? groups.find(g=>g.id===planForm.group_id)?.members.map(m=>m.id) || []
        : [];
      await createPlan({ ...planForm, invitee_ids, cover_file:planCover, creation_key:planCreationKey });
      setModal(false); setToast(true);
      setPlanForm({name:"",emoji:"🎉",date:"",time:"21:00",end_date:"",end_time:"",place_name:"",location_url:"",description:"",notes:"",plan_type:"other",color:"#8b5cf6",group_id:""});
      setPlanCover(undefined);
      setPlanCreationKey(crypto.randomUUID());
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

  const friends: Profile[] = useMemo(() => {
    const seen = new Map<string, Profile>();
    for (const g of groups) for (const m of g.members) if (m.id !== user?.id) seen.set(m.id, m);
    return Array.from(seen.values());
  }, [groups, user?.id]);

  return (
    <main className="app-shell">
      <div className="mesh-bg"><i/><i/><i/><i/></div>
      <aside className="sidebar">
        <Brand />
        <nav>
          {NAV_ITEMS.map(([id, Icon, label]) => (
            <button key={id} className={active === id && !selectedPlan ? "active" : ""} onClick={() => {setActive(id);setSelectedPlan(null)}}>
              <Icon size={20}/><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile" onClick={() => {setActive("profile");setSelectedPlan(null)}}><Avatar initials={initials} color="linear-gradient(135deg,#8b5cf6,#ec4899)"/><span><b>{name}</b><small>Mi perfil</small></span></button>
          {supabaseEnabled && (
            <button className="profile" onClick={() => signOut()}><span className="signout-icon"><LogOut size={16}/></span><span><b>Salir</b><small>Cerrar sesión</small></span></button>
          )}
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="mobile-brand"><Brand/></div>
          <div className="top-actions">
            <button className="icon-button theme-toggle" onClick={() => setLight(!light)} aria-label="Cambiar tema">{light ? <Moon size={19}/> : <Sun size={19}/>}</button>
            <button className="icon-button notification" aria-label="Notificaciones" onClick={async()=>{
              setNotificationsOpen(!notificationsOpen);
              if(!notificationsOpen){
                await markNotificationsRead().catch(()=>{});
                setNotifications(n=>n.map(x=>({...x,read_at:x.read_at||new Date().toISOString()})));
              }
            }}><Bell size={19}/>{notifications.some(n=>!n.read_at)&&<i/>}</button>
            <button className="top-profile-button" onClick={()=>{setActive("profile");setSelectedPlan(null)}} aria-label="Abrir mi perfil"><Avatar initials={initials} color="linear-gradient(135deg,#8b5cf6,#ec4899)"/></button>
          </div>
          <AnimatePresence>{notificationsOpen&&<motion.div className="notifications-panel edge" initial={{opacity:0,y:-6,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-5}}><div className="notifications-head"><div><p className="eyebrow">ACTIVIDAD</p><h3>Notificaciones</h3></div><button onClick={()=>setNotificationsOpen(false)}><X/></button></div>{notifications.length?notifications.map(n=><button className="notification-row" key={n.id} onClick={()=>{if(n.type==="friend_request")setActive("friends");else if(n.plan_id)setSelectedPlan(n.plan_id);setNotificationsOpen(false)}}><span>{n.type==="attendance"?"✓":n.type==="poll"?"◉":n.type==="location"?"⌖":n.type==="friend_request"?"👋":"•"}</span><div><b>{n.title}</b>{n.body&&<p>{n.body}</p>}<small>{new Date(n.created_at).toLocaleString("es-AR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</small></div></button>):<div className="notifications-empty"><p>Todo tranquilo por acá.</p></div>}</motion.div>}</AnimatePresence>
        </header>

        <div className="page-content">
          {selectedPlan && <PlanDetail id={selectedPlan} onBack={()=>setSelectedPlan(null)} onDeleted={()=>fetchMyPlans().then(setPlans)}/>}
          {!selectedPlan && <>
          {active === "home" && (
            <>
              <div className="greeting">
                <div><p className="eyebrow">{todayLabel}</p><h1>{greeting}, {name} <span>👋</span></h1><p>{friends.length > 0 ? "Hay lindos planes esperándote." : "Armá tu primer grupo para arrancar."}</p></div>
                <button className="create-desktop" onClick={() => setModal(true)}><Plus size={19}/> Crear Planardo</button>
              </div>

              {groups.length === 0 && !groupsLoading ? (
                <section className="social-pulse edge">
                  <div className="pulse-copy">
                    <div className="live-label"><i/> PARA ARRANCAR</div>
                    <h2>Todavía no tenés<br/>ningún <span>grupo</span> <b>👥</b></h2>
                    <p>Creá uno para tu barra, tu familia o donde sea, y compartí el link para que tus amigas se sumen con su cuenta.</p>
                    <div className="pulse-actions">
                      <button className="pulse-cta" onClick={() => setActive("groups")}><Plus size={18}/> Crear mi primer grupo</button>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="social-pulse edge">
                  <div className="pulse-copy">
                    <div className="live-label"><i/> TU GENTE</div>
                    <h2>Tenés <span>{friends.length}</span> {friends.length === 1 ? "amiga/o" : "amigas/os"}<br/>en {groups.length} {groups.length === 1 ? "grupo" : "grupos"} <b>🔥</b></h2>
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
                        <Avatar initials={initialsOf(person.name)} color={person.avatar_color}/>
                        <span>{person.name}</span>
                      </motion.div>
                    ))}
                    <div className="orbit-center"><span>{friends.length}</span><small>en tus grupos</small></div>
                  </div>
                </section>
              )}

              <section className="week-social">
                <div className="section-title">
                  <div><h2>Tus grupos</h2><p>Un vistazo rápido — el detalle está en la pestaña Grupos</p></div>
                  <button className="see-all" onClick={() => setActive("groups")}>Ver todos <ChevronRight size={16}/></button>
                </div>
                <div className="social-days">
                  {groups.slice(0, 5).map((g) => (
                    <button key={g.id} className="social-day edge" onClick={() => setActive("groups")}>
                      <span className="social-date"><b style={{ fontSize: 22 }}>{g.emoji}</b></span>
                      <span className="social-people">
                        {g.members.slice(0, 4).map((m) => <Avatar key={m.id} initials={initialsOf(m.name)} color={m.avatar_color} small/>)}
                      </span>
                      <span className="social-count"><i/>{g.name}</span>
                    </button>
                  ))}
                  {groups.length === 0 && !groupsLoading && (
                    <button className="social-day edge" onClick={() => setActive("groups")}>
                      <span className="social-count">+ Crear grupo</span>
                    </button>
                  )}
                </div>
              </section>
              <section className="upcoming">
                <div className="section-title"><div><h2>Próximos Planardos</h2><p>Planes reales de tus grupos</p></div></div>
                {plans.length ? <div className="event-track">{plans.slice(0,3).map((plan:any)=>{
                  const date=new Date(plan.starts_at);
                  return <article className="event-card" onClick={()=>setSelectedPlan(plan.id)} key={plan.id} style={{background:`linear-gradient(145deg,${plan.color},#21152f)`}}>
                    <div className="event-top"><span className="event-emoji">{plan.emoji}</span><span className="event-status"><i/> {plan.my_response==="going"?"Voy":"Pendiente"}</span></div>
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
                <div><p className="eyebrow">DISPONIBILIDAD</p><h1>¿Cuándo pueden?</h1><p>PLANARDO encuentra la mejor coincidencia por ustedes.</p></div>
              </div>
              <AvailabilityView groups={groups}/>
              <section className="calendar-section">
                <div className="calendar-card edge">
                  <div className="calendar-header">
                    <div><p className="eyebrow">{calendarMonth.toLocaleDateString("es-AR",{month:"long"}).toUpperCase()}</p><h2>{calendarMonth.getFullYear()}</h2></div>
                    <div className="calendar-nav"><button onClick={()=>setCalendarMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}><ChevronLeft/></button><button onClick={()=>setCalendarMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}><ChevronRight/></button></div>
                  </div>
                  <div className="weekdays">{["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"].map(d=><span key={d}>{d}</span>)}</div>
                  <div className="calendar-grid">
                    {days.map((day,i) => day === null ? <div className="day muted" key={i}/> :
                      <button key={i} onClick={() => setSelectedDay(day)} className={`day ${selectedDay?.toDateString()===day.toDateString()?"selected":""} ${day.toDateString()===new Date().toDateString()?"today":""}`}>
                        <span className="day-number">{day.getDate()}</span>
                        <span className="calendar-plan-dots">{plans.filter(plan=>{
                          const start=new Date(plan.starts_at),end=plan.ends_at?new Date(plan.ends_at):start;
                          const from=new Date(day.getFullYear(),day.getMonth(),day.getDate());
                          const until=new Date(day.getFullYear(),day.getMonth(),day.getDate()+1);
                          return start<until&&end>=from;
                        }).slice(0,3).map(plan=><i key={plan.id} style={{background:plan.color}} title={`${plan.emoji} ${plan.name}`}/>)}</span>
                      </button>
                    )}
                  </div>
                </div>
                <aside className="day-detail edge">
                  {selectedDay ? (
                    <>
                      <div className="day-detail-head"><div><p className="eyebrow">{selectedDay.toLocaleDateString("es-AR",{weekday:"long"}).toUpperCase()}</p><h3>{selectedDay.toLocaleDateString("es-AR",{day:"numeric",month:"long"})}</h3></div><button onClick={() => setSelectedDay(null)}><X size={18}/></button></div>
                      <div className="day-plans">{plans.filter(plan=>{
                        const start=new Date(plan.starts_at),end=plan.ends_at?new Date(plan.ends_at):start;
                        const from=new Date(selectedDay.getFullYear(),selectedDay.getMonth(),selectedDay.getDate());
                        const until=new Date(selectedDay.getFullYear(),selectedDay.getMonth(),selectedDay.getDate()+1);
                        return start<until&&end>=from;
                      }).map(plan=><button key={plan.id} onClick={()=>setSelectedPlan(plan.id)}><span style={{background:plan.color}}>{plan.emoji}</span><div><b>{plan.name}</b><small>{new Date(plan.starts_at).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})} · {plan.my_response==="going"?"Confirmado":"Pendiente"}</small></div><ChevronRight/></button>)}</div>
                      {!plans.some(plan=>{const start=new Date(plan.starts_at),end=plan.ends_at?new Date(plan.ends_at):start;const from=new Date(selectedDay.getFullYear(),selectedDay.getMonth(),selectedDay.getDate());const until=new Date(selectedDay.getFullYear(),selectedDay.getMonth(),selectedDay.getDate()+1);return start<until&&end>=from})&&<p className="availability-note">No tenés Planardos este día.</p>}
                    </>
                  ) : (
                    <p className="availability-note">Tocá un día del calendario para verlo acá.</p>
                  )}
                </aside>
              </section>
            </>
          )}

          {active === "groups" && (
            <GroupsView groups={groups} loading={groupsLoading} onRefresh={refreshGroups} />
          )}

          {active === "friends" && <FriendsView />}

          {active === "history" && <>
            <div className="greeting"><div><p className="eyebrow">RECUERDOS</p><h1>Historial</h1><p>Los planes terminan; las historias quedan.</p></div></div>
            {plans.filter(p=>p.status==="completed"||new Date(p.starts_at)<new Date()).length?<div className="history-grid">{plans.filter(p=>p.status==="completed"||new Date(p.starts_at)<new Date()).map(p=><button className="history-card edge" key={p.id} onClick={()=>setSelectedPlan(p.id)}><span style={{background:p.color}}>{p.emoji}</span><div><time>{new Date(p.starts_at).toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"})}</time><h3>{p.name}</h3><p>{p.place_name||"Sin ubicación"}</p></div><ChevronRight/></button>)}</div>:<div className="empty-state edge"><span className="empty-emoji">📸</span><h3>Todavía no hay recuerdos</h3><p>Cuando termine un Planardo aparecerá acá con sus fotos, asistentes y comentarios.</p></div>}
          </>}

          {active === "profile" && (
            <ProfileView fallbackName={name} email={user?.email} groupCount={groups.length} friendCount={friends.length} onChanged={setMyProfile}/>
          )}
          </>}
        </div>
      </section>

      <button className="fab" onClick={()=>setModal(true)} aria-label="Crear Planardo"><Plus/></button>
      <nav className="bottom-nav">
        {NAV_ITEMS.map(([id,Icon,label])=><button key={id} className={active===id?"active":""} onClick={()=>{setActive(id);setSelectedPlan(null)}}><Icon size={20}/><span>{label}</span></button>)}
        <button onClick={()=>setActive("profile")} className={active==="profile"?"active":""}><span className="nav-avatar">{initials}</span><span>Perfil</span></button>
      </nav>

      <AnimatePresence>
        {modal && <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={(e)=>e.target===e.currentTarget&&setModal(false)}>
          <motion.div className="modal edge" initial={{opacity:0,y:30,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:30,scale:.97}} transition={{type:"spring",damping:26,stiffness:300}}>
            <div className="modal-handle"/>
            <div className="modal-head"><div><p className="eyebrow">NUEVO PLAN</p><h2>Crear un Planardo <span>✨</span></h2></div><button onClick={()=>setModal(false)}><X/></button></div>
            <div className="form">
              <div className="template-strip"><span>Empezar con una plantilla</span><div>{[["🥩","Asado","food"],["🎂","Cumple","birthday"],["✈️","Viaje","trip"],["🎮","Juegos","gaming"],["🍽️","Cena","food"]].map(([emoji,label,type])=><button type="button" key={label} onClick={()=>setPlanForm({...planForm,emoji,plan_type:type,name:planForm.name||label})}><b>{emoji}</b><small>{label}</small></button>)}</div></div>
              <label className="main-input"><span className="emoji-picker">{planForm.emoji}</span><input autoFocus placeholder="¿Qué plan pinta?" value={planForm.name} onChange={e=>setPlanForm({...planForm,name:e.target.value})}/></label>
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
              <label className="field"><span><MapPin size={17}/> Link de ubicación</span><input type="url" placeholder="https://maps.google.com/…" value={planForm.location_url} onChange={e=>setPlanForm({...planForm,location_url:e.target.value})}/></label>
              <label className="field"><span>Descripción</span><input placeholder="Contales de qué se trata" value={planForm.description} onChange={e=>setPlanForm({...planForm,description:e.target.value})}/></label>
              <label className="field"><span>Foto de portada (opcional)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setPlanCover(e.target.files?.[0])}/></label>
              <label className="field"><span><Users size={17}/> Grupo</span><select value={planForm.group_id} onChange={e=>setPlanForm({...planForm,group_id:e.target.value})}><option value="">Sin grupo</option>{groups.map(g=><option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}</select></label>
              <label className="field">
                <span><Users size={17}/> Invitados</span>
                {friends.length > 0 ? (
                  <div className="invite-preview">{friends.slice(0,4).map(p=><Avatar key={p.id} initials={initialsOf(p.name)} color={p.avatar_color} small/>)}<span style={{fontSize:11,color:"var(--muted)",marginLeft:10}}>de tus grupos</span></div>
                ) : (
                  <p style={{fontSize:11,color:"var(--muted)",margin:0}}>Todavía no tenés amigos en ningún grupo. <button type="button" className="auth-link" onClick={()=>{setModal(false);setActive("groups");}}>Creá un grupo</button></p>
                )}
              </label>
              <div className="color-select"><span>Color del plan</span><div>{["#8b5cf6","#f97316","#06b6d4","#22c55e","#ec4899"].map(c=><button type="button" key={c} onClick={()=>setPlanForm({...planForm,color:c})} className={planForm.color===c?"selected":""} style={{background:c}}>{planForm.color===c&&<Check/>}</button>)}</div></div>
              <button className="create-submit" disabled={planSaving||!planForm.name||!planForm.date} onClick={savePlan}>{planSaving?"Creando…":"Crear Planardo"} <Sparkles size={18}/></button>
              <p className="form-note">Podés cambiar todos los detalles después</p>
            </div>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
      <AnimatePresence>{toast&&<motion.div className="toast" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}}><span><Check/></span><div><b>¡Planardo creado!</b><p>Ahora invitá a tus amigos</p></div></motion.div>}</AnimatePresence>
    </main>
  );
}
