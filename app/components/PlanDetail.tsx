"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Car, Check, CheckCircle2, ChevronRight, CircleDollarSign, Clock3, ExternalLink, ImagePlus, ListChecks, MapPin, MessageCircle, Plus, Send, Users, Vote, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addChecklistItem, addExpense, addPlanItem, addPoll, addTimelineItem, claimPlanItem,
  addPlanComment, fetchPlanDetail, respondToPlan, sendPlanMessage, setPlanTransport, toggleChecklistItem, uploadPlanPhoto, votePoll,
} from "@/lib/plans";
import Avatar from "./Avatar";

const TABS = [
  ["overview","Resumen",CalendarDays],["people","Invitados",Users],["organize","Organizar",ListChecks],
  ["polls","Encuestas",Vote],["budget","Gastos",CircleDollarSign],["chat","Chat",MessageCircle],["memories","Fotos",ImagePlus],
] as const;
const initials=(name:string)=>name.slice(0,2).toUpperCase();

export default function PlanDetail({id,onBack}:{id:string;onBack:()=>void}) {
  const [plan,setPlan]=useState<any>(null);
  const [tab,setTab]=useState<string>("overview");
  const [loading,setLoading]=useState(true);
  const [composer,setComposer]=useState("");
  const [quick,setQuick]=useState<{type:string;open:boolean}>({type:"",open:false});
  const [field,setField]=useState("");
  const [field2,setField2]=useState("");
  const [comment,setComment]=useState("");
  const [conflicts,setConflicts]=useState<Array<{id:string;name:string;emoji:string;starts_at:string;ends_at:string|null}>>([]);
  const photoRef=useRef<HTMLInputElement>(null);
  const load=useCallback(()=>{setLoading(true);fetchPlanDetail(id).then(setPlan).finally(()=>setLoading(false));},[id]);
  useEffect(()=>{load()},[load]);

  const stats=useMemo(()=>{
    const members=plan?.plan_members||[];
    return {going:members.filter((m:any)=>m.response==="going").length,maybe:members.filter((m:any)=>m.response==="maybe").length,pending:members.filter((m:any)=>m.response==="pending").length,declined:members.filter((m:any)=>m.response==="declined").length};
  },[plan]);
  if(loading)return <div className="detail-loading"><div className="auth-loading-mark"/></div>;
  if(!plan)return <div className="empty-state"><h3>No encontramos este Planardo</h3><button onClick={onBack}>Volver</button></div>;
  const start=new Date(plan.starts_at), end=plan.ends_at?new Date(plan.ends_at):null;
  const days=end?Math.max(1,Math.round((end.getTime()-start.getTime())/86400000)+1):1;

  async function answer(response:"going"|"maybe"|"declined"){
    const result=await respondToPlan(id,response);
    if(result.status==="conflict"){setConflicts(result.conflicts||[]);return;}
    setConflicts([]);load();
  }
  async function submitQuick(){
    if(!field.trim())return;
    if(quick.type==="check")await addChecklistItem(id,field);
    if(quick.type==="item")await addPlanItem(id,field);
    if(quick.type==="timeline")await addTimelineItem(id,field,field2);
    if(quick.type==="expense")await addExpense(id,field,Number(field2));
    if(quick.type==="poll")await addPoll(id,field,field2.split(",").map(x=>x.trim()));
    setQuick({type:"",open:false});setField("");setField2("");load();
  }
  async function send(){if(!composer.trim())return;await sendPlanMessage(id,composer.trim());setComposer("");load()}

  return <section className="plan-detail">
    <button className="detail-back" onClick={onBack}><ArrowLeft size={17}/> Volver</button>
    <div className="plan-hero edge" style={{"--plan-color":plan.color} as React.CSSProperties}>
      {plan.cover_url&&<img className="plan-cover" src={plan.cover_url} alt=""/>}
      <div className="plan-hero-top"><span className="plan-big-emoji">{plan.emoji}</span><span className="plan-type">{plan.plan_type||"Plan"}</span></div>
      <div><p>{start.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase()}</p><h1>{plan.name}</h1><span className="hero-meta"><Clock3 size={15}/>{start.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}{end&&<> · {days>1?`${days} días · ${days-1} noches`:`hasta ${end.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}`}</>}</span>{plan.place_name&&<span className="hero-meta"><MapPin size={15}/>{plan.place_name}{plan.location_url&&<a href={plan.location_url} target="_blank"><ExternalLink size={13}/></a>}</span>}</div>
      <div className="hero-people"><div>{plan.plan_members.slice(0,6).map((m:any)=><Avatar key={m.user_id} initials={initials(m.profiles.name)} color={m.profiles.avatar_color} src={m.profiles.avatar_url}/>)}</div><span><b>{stats.going}</b> confirmados · {stats.pending} pendientes</span></div>
    </div>
    <div className="response-bar edge"><span>¿Te sumás?</span><div><button onClick={()=>answer("going")} className="going">✓ Voy</button><button onClick={()=>answer("maybe")} className="maybe">Tal vez</button><button onClick={()=>answer("declined")} className="declined">No puedo</button></div></div>
    <div className="detail-tabs">{TABS.map(([key,label,Icon])=><button key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}><Icon size={16}/><span>{label}</span></button>)}</div>

    <AnimatePresence mode="wait"><motion.div key={tab} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-3}} className="detail-content">
      {tab==="overview"&&<div className="detail-grid">
        <article className="detail-card edge"><div className="detail-card-head"><div><p className="eyebrow">CONTEXTO</p><h3>Sobre el plan</h3></div></div><p className="detail-copy">{plan.description||"Todavía no agregaron una descripción."}</p>{plan.notes&&<div className="plan-note"><b>Nota importante</b><p>{plan.notes}</p></div>}</article>
        <article className="detail-card edge"><div className="detail-card-head"><div><p className="eyebrow">ITINERARIO</p><h3>Línea de tiempo</h3></div><button onClick={()=>setQuick({type:"timeline",open:true})}><Plus/></button></div>{plan.timeline.length?plan.timeline.map((x:any)=><div className="timeline-row" key={x.id}><time>{new Date(x.starts_at).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</time><i/><span><b>{x.title}</b>{x.place_name&&<small>{x.place_name}</small>}</span></div>):<p className="detail-empty">Agregá actividades, horarios y paradas.</p>}</article>
      </div>}
      {tab==="people"&&<><div className="attendance-summary">{[["going","Confirmados",stats.going],["maybe","Tal vez",stats.maybe],["pending","Pendientes",stats.pending],["declined","No pueden",stats.declined]].map(([key,label,count])=><div key={key as string} className={key as string}><b>{count}</b><span>{label}</span></div>)}</div><div className="guest-grid">{plan.plan_members.map((m:any)=><div className="guest-card edge" key={m.user_id}><Avatar initials={initials(m.profiles.name)} color={m.profiles.avatar_color} src={m.profiles.avatar_url}/><span><b>{m.profiles.name}</b><small>@{m.profiles.username}</small></span><i className={`guest-status ${m.response}`}/></div>)}</div></>}
      {tab==="organize"&&<div className="detail-grid">
        <article className="detail-card edge"><div className="detail-card-head"><div><p className="eyebrow">CHECKLIST</p><h3>Lo que falta hacer</h3></div><button onClick={()=>setQuick({type:"check",open:true})}><Plus/></button></div>{plan.checklist.map((x:any)=><button className={`check-row ${x.completed?"done":""}`} key={x.id} onClick={async()=>{await toggleChecklistItem(x.id,!x.completed);load()}}>{x.completed?<CheckCircle2/>:<span/>}<b>{x.label}</b></button>)}{!plan.checklist.length&&<p className="detail-empty">Todo bajo control. Agregá la primera tarea.</p>}</article>
        <article className="detail-card edge"><div className="detail-card-head"><div><p className="eyebrow">QUIÉN LLEVA QUÉ</p><h3>Lista colaborativa</h3></div><button onClick={()=>setQuick({type:"item",open:true})}><Plus/></button></div>{plan.items.map((x:any)=><button className="bring-row" key={x.id} onClick={async()=>{await claimPlanItem(x.id,!x.claimed_by);load()}}><span>{x.claimed_by?<Check/>:<Plus/>}</span><b>{x.label}</b><small>{x.profiles?.name||"Me anoto"}</small></button>)}{!plan.items.length&&<p className="detail-empty">Agregá bebidas, comida o cualquier cosa necesaria.</p>}</article>
        <article className="detail-card edge"><div className="detail-card-head"><div><p className="eyebrow">TRANSPORTE</p><h3>¿Cómo llega cada uno?</h3></div><Car size={17}/></div><div className="transport-choices">{[["car","🚗 Auto"],["rideshare","🚕 Uber"],["walk","🚶 Caminando"],["bus","🚌 Colectivo"],["bike","🚲 Bici"]].map(([mode,label])=><button key={mode} onClick={async()=>{await setPlanTransport(id,mode,mode==="car"?3:0);load()}}>{label}</button>)}</div>{plan.transport.map((x:any)=><div className="transport-row" key={x.user_id}><Avatar initials={initials(x.profiles.name)} color={x.profiles.avatar_color} src={x.profiles.avatar_url} small/><b>{x.profiles.name}</b><span>{x.mode}{x.seats_available?` · ${x.seats_available} lugares`:""}</span></div>)}</article>
      </div>}
      {tab==="polls"&&<><button className="inline-create" onClick={()=>setQuick({type:"poll",open:true})}><Plus/> Nueva encuesta</button><div className="poll-grid">{plan.polls.map((poll:any)=><article className="detail-card edge" key={poll.id}><p className="eyebrow">ENCUESTA</p><h3>{poll.question}</h3><div className="poll-options">{poll.poll_options.map((o:any)=>{const votes=o.poll_votes.length;return <button key={o.id} onClick={async()=>{await votePoll(o.id);load()}}><span>{o.emoji} {o.label}</span><b>{votes}</b><i style={{width:`${Math.min(100,votes/Math.max(1,plan.plan_members.length)*100)}%`}}/></button>})}</div></article>)}</div>{!plan.polls.length&&<div className="empty-state edge"><span className="empty-emoji">🗳️</span><h3>Decidan juntos</h3><p>Creá una votación para elegir comida, lugar, horario o actividad.</p></div>}</>}
      {tab==="budget"&&<><div className="budget-total edge"><span>Total estimado</span><b>${plan.expenses.reduce((s:number,e:any)=>s+Number(e.amount),0).toLocaleString("es-AR")}</b><small>${Math.round(plan.expenses.reduce((s:number,e:any)=>s+Number(e.amount),0)/Math.max(1,stats.going)).toLocaleString("es-AR")} por confirmado</small></div><button className="inline-create" onClick={()=>setQuick({type:"expense",open:true})}><Plus/> Agregar gasto</button><div className="expense-list">{plan.expenses.map((e:any)=><div className="expense-row edge" key={e.id}><span><CircleDollarSign/></span><div><b>{e.label}</b><small>Pagó {e.profiles?.name||"—"}</small></div><strong>${Number(e.amount).toLocaleString("es-AR")}</strong></div>)}</div></>}
      {tab==="chat"&&<div className="chat-panel edge"><div className="messages">{plan.messages.map((m:any)=><div className="message" key={m.id}><Avatar initials={initials(m.profiles.name)} color={m.profiles.avatar_color} src={m.profiles.avatar_url} small/><div><span><b>{m.profiles.name}</b><small>{new Date(m.created_at).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</small></span><p>{m.body}</p></div></div>)}{!plan.messages.length&&<p className="detail-empty">El chat arranca con el primer mensaje.</p>}</div><div className="chat-composer"><input value={composer} onChange={e=>setComposer(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Escribí un mensaje…"/><button onClick={send}><Send/></button></div></div>}
      {tab==="memories"&&<div className="memories-layout"><div className="photos-head"><div><h3>Fotos del Planardo</h3><p>Un álbum privado para quienes participaron.</p></div><button className="inline-create" onClick={()=>photoRef.current?.click()}><ImagePlus/> Subir foto</button><input ref={photoRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const f=e.target.files?.[0];if(f){await uploadPlanPhoto(id,f);load()}}}/></div>{plan.photos.length?<div className="photo-grid">{plan.photos.map((p:any)=><img src={p.url} alt={p.caption||"Foto del Planardo"} key={p.id}/>)}</div>:<div className="empty-state edge"><span className="empty-emoji">📷</span><h3>El álbum está vacío</h3><p>Subí la primera foto de este Planardo.</p></div>}<div className="comments-card edge"><h3>Comentarios</h3>{plan.comments.map((c:any)=><div className="comment-row" key={c.id}><Avatar initials={initials(c.profiles.name)} color={c.profiles.avatar_color} src={c.profiles.avatar_url} small/><div><b>{c.profiles.name}</b><p>{c.body}</p></div></div>)}<div className="chat-composer"><input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Dejá un comentario…"/><button onClick={async()=>{if(comment.trim()){await addPlanComment(id,comment);setComment("");load()}}}><Send/></button></div></div></div>}
    </motion.div></AnimatePresence>

    <AnimatePresence>{quick.open&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="quick-modal edge" initial={{scale:.96,y:12}} animate={{scale:1,y:0}}><div className="modal-head"><div><p className="eyebrow">AGREGAR</p><h2>{quick.type==="check"?"Nueva tarea":quick.type==="item"?"¿Qué hay que llevar?":quick.type==="timeline"?"Actividad":quick.type==="expense"?"Nuevo gasto":"Nueva encuesta"}</h2></div><button onClick={()=>setQuick({type:"",open:false})}><X/></button></div><label className="quick-field"><span>{quick.type==="poll"?"Pregunta":"Nombre"}</span><input autoFocus value={field} onChange={e=>setField(e.target.value)}/></label>{["timeline","expense","poll"].includes(quick.type)&&<label className="quick-field"><span>{quick.type==="timeline"?"Fecha y hora":quick.type==="expense"?"Importe":"Opciones separadas por coma"}</span><input type={quick.type==="timeline"?"datetime-local":quick.type==="expense"?"number":"text"} value={field2} onChange={e=>setField2(e.target.value)}/></label>}<button className="create-submit" onClick={submitQuick}>Agregar <ChevronRight/></button></motion.div></motion.div>}</AnimatePresence>
    <AnimatePresence>{conflicts.length>0&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="conflict-modal edge" initial={{scale:.96,y:12}} animate={{scale:1,y:0}}><span className="conflict-icon">!</span><h2>Ya tenés otro plan</h2><p>Para cuidar tu agenda, no podés confirmar dos Planardos superpuestos.</p>{conflicts.map(c=><div className="conflict-plan" key={c.id}><b>{c.emoji} {c.name}</b><small>{new Date(c.starts_at).toLocaleString("es-AR",{weekday:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}</small></div>)}<button className="create-submit" onClick={()=>setConflicts([])}>Entendido</button></motion.div></motion.div>}</AnimatePresence>
  </section>
}
