"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, CalendarDays, Check, ChevronLeft, ChevronRight,
  Clock3, Home, LogOut, MapPin, Moon, Plus, Sparkles, Sun, Users, X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./components/AuthProvider";
import { supabaseEnabled } from "@/lib/supabase";
import { fetchMyGroups, type Group, type Profile } from "@/lib/groups";
import Avatar from "./components/Avatar";
import GroupsView from "./components/GroupsView";

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
];

export default function Page() {
  const { user, signOut } = useAuth();
  const [active, setActive] = useState("home");
  const [modal, setModal] = useState(false);
  const [light, setLight] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [toast, setToast] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

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
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoading(false));
  }, []);

  useEffect(() => {
    if (user || !supabaseEnabled) refreshGroups();
  }, [user, refreshGroups]);

  const days = useMemo(() => Array.from({ length: 35 }, (_, i) => (i < 2 || i > 31 ? null : i - 1)), []);

  const savePlan = () => {
    setModal(false);
    setToast(true);
    window.setTimeout(() => setToast(false), 3200);
  };

  const rawName = (user?.user_metadata?.name as string | undefined) || user?.email?.split("@")[0] || "vos";
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
            <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}>
              <Icon size={20}/><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile" onClick={() => setActive("profile")}><Avatar initials={initials} color="linear-gradient(135deg,#8b5cf6,#ec4899)"/><span><b>{name}</b><small>Mi perfil</small></span></button>
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
            <button className="icon-button notification" aria-label="Notificaciones"><Bell size={19}/><i/></button>
            <Avatar initials={initials} color="linear-gradient(135deg,#8b5cf6,#ec4899)"/>
          </div>
        </header>

        <div className="page-content">
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
            </>
          )}

          {active === "calendar" && (
            <>
              <div className="greeting">
                <div><p className="eyebrow">CALENDARIO</p><h1>Tus fechas <span>📅</span></h1><p>Elegí un día para verlo de cerca.</p></div>
              </div>
              <section className="calendar-section">
                <div className="calendar-card edge">
                  <div className="calendar-header">
                    <div><p className="eyebrow">AGOSTO</p><h2>2026</h2></div>
                    <div className="calendar-nav"><button><ChevronLeft/></button><button><ChevronRight/></button></div>
                  </div>
                  <div className="weekdays">{["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"].map(d=><span key={d}>{d}</span>)}</div>
                  <div className="calendar-grid">
                    {days.map((day,i) => day === null ? <div className="day muted" key={i}/> :
                      <button key={i} onClick={() => setSelectedDay(day)} className={`day ${selectedDay===day?"selected":""} ${day===30?"today":""}`}>
                        <span className="day-number">{day}</span>
                      </button>
                    )}
                  </div>
                </div>
                <aside className="day-detail edge">
                  {selectedDay ? (
                    <>
                      <div className="day-detail-head"><div><p className="eyebrow">AGOSTO</p><h3>{selectedDay} de agosto</h3></div><button onClick={() => setSelectedDay(null)}><X size={18}/></button></div>
                      <p className="availability-note">La disponibilidad del grupo para este día todavía no está conectada — ¡se viene pronto!</p>
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

          {active === "profile" && (
            <>
              <div className="greeting">
                <div><p className="eyebrow">MI PERFIL</p><h1>{name} <span>👤</span></h1><p>{user?.email}</p></div>
              </div>
              <div className="empty-state edge">
                <Avatar initials={initials} color="linear-gradient(135deg,#8b5cf6,#ec4899)"/>
                <h3 style={{ marginTop: 14 }}>{name}</h3>
                <p>{groups.length} {groups.length === 1 ? "grupo" : "grupos"} · {friends.length} {friends.length === 1 ? "amiga/o" : "amigas/os"}</p>
                {supabaseEnabled && <button className="create-submit" onClick={() => signOut()}><LogOut size={17}/> Cerrar sesión</button>}
              </div>
            </>
          )}
        </div>
      </section>

      <button className="fab" onClick={()=>setModal(true)} aria-label="Crear Planardo"><Plus/></button>
      <nav className="bottom-nav">
        {NAV_ITEMS.map(([id,Icon,label])=><button key={id} className={active===id?"active":""} onClick={()=>setActive(id)}><Icon size={20}/><span>{label}</span></button>)}
        <button onClick={()=>setActive("profile")} className={active==="profile"?"active":""}><span className="nav-avatar">{initials}</span><span>Perfil</span></button>
      </nav>

      <AnimatePresence>
        {modal && <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={(e)=>e.target===e.currentTarget&&setModal(false)}>
          <motion.div className="modal edge" initial={{opacity:0,y:30,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:30,scale:.97}} transition={{type:"spring",damping:26,stiffness:300}}>
            <div className="modal-handle"/>
            <div className="modal-head"><div><p className="eyebrow">NUEVO PLAN</p><h2>Crear un Planardo <span>✨</span></h2></div><button onClick={()=>setModal(false)}><X/></button></div>
            <div className="form">
              <label className="main-input"><span className="emoji-picker">🎉</span><input autoFocus placeholder="¿Qué plan pinta?"/></label>
              <div className="field-row">
                <label><span><CalendarDays size={17}/> Fecha</span><input type="date"/></label>
                <label><span><Clock3 size={17}/> Hora</span><input type="time" defaultValue="21:00"/></label>
              </div>
              <label className="field"><span><MapPin size={17}/> Lugar</span><input placeholder="¿Dónde se juntan?"/></label>
              <label className="field">
                <span><Users size={17}/> Invitados</span>
                {friends.length > 0 ? (
                  <div className="invite-preview">{friends.slice(0,4).map(p=><Avatar key={p.id} initials={initialsOf(p.name)} color={p.avatar_color} small/>)}<span style={{fontSize:11,color:"var(--muted)",marginLeft:10}}>de tus grupos</span></div>
                ) : (
                  <p style={{fontSize:11,color:"var(--muted)",margin:0}}>Todavía no tenés amigos en ningún grupo. <button type="button" className="auth-link" onClick={()=>{setModal(false);setActive("groups");}}>Creá un grupo</button></p>
                )}
              </label>
              <div className="color-select"><span>Color del plan</span><div>{["#8b5cf6","#f97316","#06b6d4","#22c55e","#ec4899"].map((c,i)=><button key={c} className={i===0?"selected":""} style={{background:c}}>{i===0&&<Check/>}</button>)}</div></div>
              <button className="create-submit" onClick={savePlan}>Crear Planardo <Sparkles size={18}/></button>
              <p className="form-note">Podés cambiar todos los detalles después</p>
            </div>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
      <AnimatePresence>{toast&&<motion.div className="toast" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}}><span><Check/></span><div><b>¡Planardo creado!</b><p>Ahora invitá a tus amigos</p></div></motion.div>}</AnimatePresence>
    </main>
  );
}
