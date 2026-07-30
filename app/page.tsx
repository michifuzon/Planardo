"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  Clock3, Home, LogOut, MapPin, Moon, Plus, Search, Sparkles, Sun, Users, X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./components/AuthProvider";
import { supabaseEnabled } from "@/lib/supabase";

type EventCard = {
  id: number; emoji: string; title: string; date: string; time: string;
  place: string; confirmed: number; pending: number; color: string; accent: string;
  avatars: string[];
};

const events: EventCard[] = [
  {
    id: 1, emoji: "🍕", title: "Pizza en casa de Sofi", date: "Viernes 21", time: "21:30",
    place: "Casa de Sofi, Palermo", confirmed: 7, pending: 2,
    color: "linear-gradient(145deg,#7c3aed 0%,#4c1d95 52%,#23143d 100%)", accent: "#c4a2ff",
    avatars: ["S", "E", "F", "M"],
  },
  {
    id: 2, emoji: "🎸", title: "Festival en Costanera", date: "Sábado 29", time: "18:00",
    place: "Ciudad Universitaria", confirmed: 5, pending: 3,
    color: "linear-gradient(145deg,#f97316 0%,#a83d0a 48%,#31170d 100%)", accent: "#ffd0a8",
    avatars: ["L", "F", "A", "J"],
  },
  {
    id: 3, emoji: "🌿", title: "Picnic & mate", date: "Domingo 30", time: "13:00",
    place: "Bosques de Palermo", confirmed: 4, pending: 1,
    color: "linear-gradient(145deg,#0d9488 0%,#075e58 50%,#0b2928 100%)", accent: "#9df5e9",
    avatars: ["M", "S", "V"],
  },
];

const people = [
  { initials: "SO", name: "Sofi", color: "#fb7185" },
  { initials: "EM", name: "Emma", color: "#8b5cf6" },
  { initials: "MI", name: "Mica", color: "#06b6d4" },
  { initials: "FA", name: "Facu", color: "#f59e0b" },
];

const availability: Record<number, number[]> = { 3:[0,1], 5:[2], 8:[0,2,3], 11:[1,3], 14:[0,1,2], 17:[2,3], 21:[0,1,2,3], 24:[0,2], 27:[1,2,3], 29:[0,1,3] };

function Avatar({ initials, color, small = false }: { initials:string; color:string; small?:boolean }) {
  return <span className={`avatar ${small ? "avatar-small" : ""}`} style={{ background: color }}>{initials}</span>;
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <i className="m-core" />
        <i className="m-dot" />
        <i className="m-dot" />
        <i className="m-dot" />
      </span>
      <span>PLANARDO</span>
    </div>
  );
}

export default function Page() {
  const { user, signOut } = useAuth();
  const [active, setActive] = useState("home");
  const [modal, setModal] = useState(false);
  const [light, setLight] = useState(false);
  const [selectedDay, setSelectedDay] = useState(21);
  const [socialDay, setSocialDay] = useState(2);
  const [cardIndex, setCardIndex] = useState(0);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
  }, [light]);

  const days = useMemo(() => Array.from({ length: 35 }, (_, i) => i < 2 || i > 31 ? null : i - 1), []);

  const savePlan = () => {
    setModal(false); setToast(true);
    window.setTimeout(() => setToast(false), 3200);
  };

  const rawName = (user?.user_metadata?.name as string | undefined) || user?.email?.split("@")[0] || "Faustina";
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const initials = name.slice(0, 2).toUpperCase();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav>
          {[
            ["home", Home, "Inicio"], ["calendar", CalendarDays, "Calendario"],
            ["friends", Users, "Amigos"], ["search", Search, "Explorar"],
          ].map(([id, Icon, label]) => (
            <button key={String(id)} className={active === id ? "active" : ""} onClick={() => setActive(String(id))}>
              <Icon size={20}/><span>{String(label)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile"><Avatar initials={initials} color="linear-gradient(135deg,#8b5cf6,#ec4899)"/><span><b>{name}</b><small>Mi perfil</small></span></button>
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
          <div className="greeting">
            <div><p className="eyebrow">JUEVES, 30 DE JULIO</p><h1>{greeting}, {name} <span>👋</span></h1><p>Hay lindos planes esperándote.</p></div>
            <button className="create-desktop" onClick={() => setModal(true)}><Plus size={19}/> Crear Planardo</button>
          </div>

          <section className="social-pulse">
            <div className="pulse-copy">
              <div className="live-label"><i/> AHORA MISMO</div>
              <h2>Hoy hay quórum para<br/>un <span>Planardo</span> <b>🔥</b></h2>
              <p>Cuatro personas de Fofas 💙 están libres. Es el momento de tirar plan.</p>
              <div className="pulse-actions">
                <button className="pulse-cta" onClick={() => setModal(true)}><Plus size={18}/> Armar plan con ellas</button>
                <button className="pulse-secondary">Ver disponibilidad <ChevronRight size={17}/></button>
              </div>
            </div>
            <div className="people-orbit">
              <div className="orbit-ring ring-one"/>
              <div className="orbit-ring ring-two"/>
              {people.map((person, index) => (
                <motion.div
                  className={`orbit-person person-${index + 1}`}
                  key={person.name}
                  initial={{ opacity: 0, scale: .7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: .12 * index, type: "spring" }}
                >
                  <Avatar initials={person.initials} color={person.color}/>
                  <span>{person.name}</span>
                  <i/>
                </motion.div>
              ))}
              <div className="orbit-center"><span>4</span><small>libres hoy</small></div>
            </div>
          </section>

          <section className="week-social">
            <div className="section-title">
              <div><h2>¿Quién está libre esta semana?</h2><p>Encontrá el mejor momento para todos</p></div>
              <button className="see-all">Ver semana completa <ChevronRight size={16}/></button>
            </div>
            <div className="social-days">
              {[
                { day:"HOY", date:"30", count:2, ids:[0,1] },
                { day:"VIE", date:"31", count:4, ids:[0,1,2,3], hot:true },
                { day:"SÁB", date:"01", count:3, ids:[0,2,3] },
                { day:"DOM", date:"02", count:1, ids:[1] },
                { day:"LUN", date:"03", count:2, ids:[1,2] },
              ].map((item,index) => (
                <button key={item.day} className={`social-day ${socialDay===index?"active":""} ${item.hot?"hot":""}`} onClick={()=>setSocialDay(index)}>
                  {item.hot && <span className="best-time">MEJOR DÍA</span>}
                  <span className="social-date"><small>{item.day}</small><b>{item.date}</b></span>
                  <span className="social-people">
                    {item.ids.map(id=><Avatar key={id} initials={people[id].initials} color={people[id].color} small/>)}
                  </span>
                  <span className="social-count"><i/>{item.count} {item.count===1?"persona":"personas"}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="upcoming">
            <div className="section-title"><div><h2>Tus próximos Planardos</h2><p>Todo lo que se viene</p></div><div className="carousel-controls"><button onClick={() => setCardIndex(Math.max(0,cardIndex-1))}><ChevronLeft/></button><button onClick={() => setCardIndex(Math.min(events.length-1,cardIndex+1))}><ChevronRight/></button></div></div>
            <div className="event-track" style={{ "--offset": cardIndex } as React.CSSProperties}>
              {events.map((event, idx) => (
                <motion.article whileHover={{ y:-5 }} whileTap={{ scale:.985 }} className="event-card" style={{ background:event.color }} key={event.id}>
                  <div className="card-glow"/>
                  <div className="event-top"><span className="event-emoji">{event.emoji}</span><span className="event-status"><i/> Confirmado</span></div>
                  <div className="event-main">
                    <p>{event.date.toUpperCase()} · {event.time}</p><h3>{event.title}</h3>
                    <div className="place"><MapPin size={17}/>{event.place}</div>
                  </div>
                  <div className="event-bottom">
                    <div className="avatar-stack">
                      {event.avatars.map((a,i)=><Avatar key={i} initials={a} color={["#fb7185","#8b5cf6","#06b6d4","#f59e0b"][i]} small/> )}
                      <span className="more-people">+{event.confirmed-event.avatars.length}</span>
                    </div>
                    <span className="people-count"><b>{event.confirmed}</b> van · {event.pending} pendientes</span>
                    <button aria-label="Abrir evento"><ChevronRight/></button>
                  </div>
                </motion.article>
              ))}
            </div>
            <div className="mobile-dots">{events.map((_,i)=><button onClick={()=>setCardIndex(i)} className={i===cardIndex?"active":""} key={i}/>)}</div>
          </section>

          <section className="calendar-section">
            <div className="calendar-card">
              <div className="calendar-header">
                <div><p className="eyebrow">DISPONIBILIDAD</p><h2>Agosto <span>2026</span></h2></div>
                <div className="calendar-nav"><button><ChevronLeft/></button><button><ChevronRight/></button></div>
              </div>
              <div className="weekdays">{["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"].map(d=><span key={d}>{d}</span>)}</div>
              <div className="calendar-grid">
                {days.map((day,i) => day === null ? <div className="day muted" key={i}/> :
                  <button key={i} onClick={() => setSelectedDay(day)} className={`day ${selectedDay===day?"selected":""} ${day===30?"today":""}`}>
                    <span className="day-number">{day}</span>
                    <span className="mini-avatars">
                      {(availability[day]||[]).slice(0,3).map(p=><Avatar key={p} initials={people[p].initials} color={people[p].color} small/>)}
                    </span>
                  </button>
                )}
              </div>
            </div>
            <aside className="day-detail">
              <div className="day-detail-head"><div><p className="eyebrow">VIERNES</p><h3>{selectedDay} de agosto</h3></div><button><X size={18}/></button></div>
              <div className="availability-list">
                {people.map((p,i)=><div key={p.name}><Avatar initials={p.initials} color={p.color}/><span><b>{p.name}</b><small>{i===3?"Tal vez":"Disponible"}</small></span><i className={i===3?"maybe":""}/></div>)}
              </div>
              <button className="availability-cta"><span>🟢</span> Estoy disponible <ChevronDown size={17}/></button>
              <p className="availability-note">4 amigos pueden este día. ¿Sale Planardo?</p>
            </aside>
          </section>
        </div>
      </section>

      <button className="fab" onClick={()=>setModal(true)} aria-label="Crear Planardo"><Plus/></button>
      <nav className="bottom-nav">
        {[["home",Home,"Inicio"],["calendar",CalendarDays,"Calendario"],["friends",Users,"Amigos"]].map(([id,Icon,label])=><button key={String(id)} className={active===id?"active":""} onClick={()=>setActive(String(id))}><Icon/><span>{String(label)}</span></button>)}
        <button onClick={()=>setActive("profile")} className={active==="profile"?"active":""}><span className="nav-avatar">{initials}</span><span>Perfil</span></button>
      </nav>

      <AnimatePresence>
        {modal && <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={(e)=>e.target===e.currentTarget&&setModal(false)}>
          <motion.div className="modal" initial={{opacity:0,y:30,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:30,scale:.97}} transition={{type:"spring",damping:26,stiffness:300}}>
            <div className="modal-handle"/>
            <div className="modal-head"><div><p className="eyebrow">NUEVO PLAN</p><h2>Crear un Planardo <span>✨</span></h2></div><button onClick={()=>setModal(false)}><X/></button></div>
            <div className="form">
              <label className="main-input"><span className="emoji-picker">🎉</span><input autoFocus placeholder="¿Qué plan pinta?"/></label>
              <div className="field-row">
                <label><span><CalendarDays size={17}/> Fecha</span><input type="date" defaultValue="2026-08-21"/></label>
                <label><span><Clock3 size={17}/> Hora</span><input type="time" defaultValue="21:00"/></label>
              </div>
              <label className="field"><span><MapPin size={17}/> Lugar</span><input placeholder="¿Dónde se juntan?"/></label>
              <label className="field"><span><Users size={17}/> Invitados</span><div className="invite-preview">{people.slice(0,3).map(p=><Avatar key={p.name} initials={p.initials} color={p.color} small/>)}<button><Plus size={15}/> Invitar</button></div></label>
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
