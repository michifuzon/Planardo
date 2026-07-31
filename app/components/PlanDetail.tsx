"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Car, Check, CheckCircle2, ChevronRight, CircleDollarSign, Clock3, ExternalLink, ImagePlus, ListChecks, MapPin, MessageCircle, Pencil, Plus, Send, Trash2, Users, Vote, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addChecklistItem, addExpense, addPlanItem, addPoll, addTimelineItem, claimPlanItem,
  addPlanComment, cancelPlan, deletePoll, fetchPlanDetail, respondToPlan, sendPlanMessage, setPlanTransport, toggleChecklistItem, updatePlan, uploadPlanPhoto, votePoll,
} from "@/lib/plans";
import { cap } from "@/lib/format";
import Avatar from "./Avatar";
import { useAuth } from "./AuthProvider";

const TABS = [
  ["overview","Resumen",CalendarDays],["people","Invitados",Users],["organize","Organizar",ListChecks],
  ["polls","Encuestas",Vote],["budget","Gastos",CircleDollarSign],["chat","Chat",MessageCircle],["memories","Fotos",ImagePlus],
] as const;
const initials=(name:string)=>name.slice(0,2).toUpperCase();
const pad=(n:number)=>String(n).padStart(2,"0");
function toLocalParts(iso:string){const d=new Date(iso);return {date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,time:`${pad(d.getHours())}:${pad(d.getMinutes())}`};}
const PLAN_TYPES:[string,string][]=[["food","🍕 Cena / comida"],["home","🏠 Casa"],["camping","🏕️ Camping"],["trip","✈️ Viaje"],["birthday","🎂 Cumpleaños"],["bar","🍻 Bar"],["cinema","🎬 Cine"],["outdoor","🏖️ Aire libre"],["sport","🏃 Deporte"],["gaming","🎮 Gaming"],["study","📚 Estudio"],["party","🎉 Fiesta"],["other","✨ Otro"]];
const PLAN_COLORS=["#8b5cf6","#f97316","#06b6d4","#22c55e","#ec4899"];

export default function PlanDetail({id,onBack,onDeleted}:{id:string;onBack:()=>void;onDeleted?:()=>void}) {
  const {user}=useAuth();
  const [plan,setPlan]=useState<any>(null);
  const [tab,setTab]=useState<string>("overview");
  const [loading,setLoading]=useState(true);
  const [composer,setComposer]=useState("");
  const [quick,setQuick]=useState<{type:string;open:boolean}>({type:"",open:false});
  const [field,setField]=useState("");
  const [field2,setField2]=useState("");
  const [pollOptions,setPollOptions]=useState<string[]>(["",""]);
  const [comment,setComment]=useState("");
  const [conflicts,setConflicts]=useState<Array<{id:string;name:string;emoji:string;starts_at:string;ends_at:string|null}>>([]);
  const photoRef=useRef<HTMLInputElement>(null);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [quickSaving,setQuickSaving]=useState(false);
  const [quickError,setQuickError]=useState("");
  const [editOpen,setEditOpen]=useState(false);
  const [editForm,setEditForm]=useState<any>(null);
  const [editSaving,setEditSaving]=useState(false);
  const refresh=useCallback(()=>fetchPlanDetail(id).then(setPlan),[id]);
  const load=useCallback(()=>{setLoading(true);refresh().finally(()=>setLoading(false));},[refresh]);
  useEffect(()=>{load()},[load]);

  const stats=useMemo(()=>{
    const members=plan?.plan_members||[];
    return {going:members.filter((m:any)=>m.response==="going").length,maybe:members.filter((m:any)=>m.response==="maybe").length,pending:members.filter((m:any)=>m.response==="pending").length,declined:members.filter((m:any)=>m.response==="declined").length};
  },[plan]);
  const myResponse=useMemo(()=>plan?.plan_members?.find((m:any)=>m.user_id===user?.id)?.response,[plan,user?.id]);
  if(loading)return <div className="detail-loading"><div className="auth-loading-mark"/></div>;
  if(!plan)return <div className="empty-state"><h3>No encontramos este Planardo</h3><button onClick={onBack}>Volver</button></div>;
  const start=new Date(plan.starts_at), end=plan.ends_at?new Date(plan.ends_at):null;
  const days=end?Math.max(1,Math.round((end.getTime()-start.getTime())/86400000)+1):1;

  function openEdit(){
    const startParts=toLocalParts(plan.starts_at);
    const endParts=plan.ends_at?toLocalParts(plan.ends_at):null;
    setEditForm({
      name:plan.name,emoji:plan.emoji,date:startParts.date,time:startParts.time,
      end_date:endParts?.date||"",end_time:endParts?.time||"",
      place_name:plan.place_name||"",location_url:plan.location_url||"",
      description:plan.description||"",notes:plan.notes||"",
      plan_type:plan.plan_type||"other",color:plan.color,
    });
    setEditOpen(true);
  }
  async function saveEdit(){
    if(!editForm?.name?.trim()||!editForm?.date||editSaving)return;
    setEditSaving(true);
    try{
      await updatePlan(id,editForm);
      setEditOpen(false);
      refresh();
    }finally{setEditSaving(false)}
  }

  async function answer(response:"going"|"maybe"|"declined"){
    const result=await respondToPlan(id,response);
    if(result.status==="conflict"){setConflicts(result.conflicts||[]);return;}
    setConflicts([]);refresh();
  }
  async function submitQuick(){
    if(!field.trim())return;
    if(quickSaving)return;
    setQuickSaving(true);setQuickError("");
    try{
      if(quick.type==="check")await addChecklistItem(id,field);
      if(quick.type==="item")await addPlanItem(id,field);
      if(quick.type==="timeline")await addTimelineItem(id,field,field2);
      if(quick.type==="expense")await addExpense(id,field,Number(field2));
      if(quick.type==="poll"){
        const options=pollOptions.map(x=>x.trim()).filter(Boolean);
        if(options.length<2)throw new Error("Agregá al menos dos opciones.");
        await addPoll(id,field,options);
      }
      setQuick({type:"",open:false});setField("");setField2("");setPollOptions(["",""]);refresh();
    }catch(error){
      const raw=error as {message?:string};
      setQuickError(raw?.message||"No se pudo guardar.");
    }finally{setQuickSaving(false)}
  }
  async function send(){if(!composer.trim())return;await sendPlanMessage(id,composer.trim());setComposer("");refresh()}

  return <section className="plan-detail">
    <button className="detail-back" onClick={onBack}><ArrowLeft size={17}/> Volver</button>
    <div className="plan-hero edge" style={{"--plan-color":plan.color} as React.CSSProperties}>
      {plan.cover_url&&<img className="plan-cover" src={plan.cover_url} alt=""/>}
      <div className="plan-hero-top"><span className="plan-big-emoji">{plan.emoji}</span><div className="plan-hero-actions"><span className="plan-type">{plan.plan_type||"Plan"}</span>{plan.created_by===user?.id&&plan.status!=="cancelled"&&<><button onClick={openEdit} aria-label="Editar el Planardo"><Pencil/><span>Editar</span></button><button onClick={()=>setConfirmDelete(true)} aria-label="Dar de baja el Planardo"><XCircle/><span>Dar de baja</span></button></>}</div></div>
      <div><p>{start.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase()}</p><h1>{plan.name}</h1><span className="hero-meta"><Clock3 size={15}/>{start.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}{end&&<> · {days>1?`${days} días · ${days-1} noches`:`hasta ${end.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}`}</>}</span>{plan.place_name&&<span className="hero-meta"><MapPin size={15}/>{plan.place_name}{plan.location_url&&<a href={plan.location_url} target="_blank"><ExternalLink size={13}/></a>}</span>}</div>
      <div className="hero-people"><div>{plan.plan_members.slice(0,6).map((m:any)=><Avatar key={m.user_id} initials={initials(m.profiles.name)} color={m.profiles.avatar_color} src={m.profiles.avatar_url}/>)}</div><span><b>{stats.going}</b> confirmados · {stats.pending} pendientes</span></div>
    </div>
    <div className="response-bar edge"><span>¿Te sumás?</span><div><button onClick={()=>answer("going")} className={`going ${myResponse==="going"?"selected":""}`}>✓ Voy</button><button onClick={()=>answer("maybe")} className={`maybe ${myResponse==="maybe"?"selected":""}`}>Tal vez</button><button onClick={()=>answer("declined")} className={`declined ${myResponse==="declined"?"selected":""}`}>No puedo</button></div></div>
    <div className="detail-tabs">{TABS.map(([key,label,Icon])=><button key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}><Icon size={16}/><span>{label}</span></button>)}</div>

    <AnimatePresence mode="wait"><motion.div key={tab} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-3}} className="detail-content">
      {tab==="overview"&&<div className="detail-grid">
        <article className="detail-card edge"><div className="detail-card-head"><div><p className="eyebrow">CONTEXTO</p><h3>Sobre el plan</h3></div></div><p className="detail-copy">{plan.description||"Todavía no agregaron una descripción."}</p>{plan.notes&&<div className="plan-note"><b>Nota importante</b><p>{plan.notes}</p></div>}</article>
        <article className="detail-card edge"><div className="detail-card-head"><div><p className="eyebrow">ITINERARIO</p><h3>Línea de tiempo</h3></div><button onClick={()=>setQuick({type:"timeline",open:true})}><Plus/></button></div>{plan.timeline.length?plan.timeline.map((x:any)=><div className="timeline-row" key={x.id}><time>{new Date(x.starts_at).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</time><i/><span><b>{x.title}</b>{x.place_name&&<small>{x.place_name}</small>}</span></div>):<p className="detail-empty">Agregá actividades, horarios y paradas.</p>}</article>
      </div>}
      {tab==="people"&&<><div className="attendance-summary">{[["going","Confirmados",stats.going],["maybe","Tal vez",stats.maybe],["pending","Pendientes",stats.pending],["declined","No pueden",stats.declined]].map(([key,label,count])=><div key={key as string} className={key as string}><b>{count}</b><span>{label}</span></div>)}</div><div className="guest-grid">{plan.plan_members.map((m:any)=><div className="guest-card edge" key={m.user_id}><Avatar initials={initials(m.profiles.name)} color={m.profiles.avatar_color} src={m.profiles.avatar_url}/><span><b>{m.profiles.name}</b><small>@{m.profiles.username}</small></span><i className={`guest-status ${m.response}`}/></div>)}</div></>}
      {tab==="organize"&&<div className="detail-grid">
        <article className="detail-card edge"><div className="detail-card-head"><div><p className="eyebrow">CHECKLIST</p><h3>Lo que falta hacer</h3></div><button onClick={()=>setQuick({type:"check",open:true})}><Plus/></button></div>{plan.checklist.map((x:any)=><button className={`check-row ${x.completed?"done":""}`} key={x.id} onClick={async()=>{await toggleChecklistItem(x.id,!x.completed);refresh()}}>{x.completed?<CheckCircle2/>:<span/>}<b>{x.label}</b></button>)}{!plan.checklist.length&&<p className="detail-empty">Todo bajo control. Agregá la primera tarea.</p>}</article>
        <article className="detail-card edge"><div className="detail-card-head"><div><p className="eyebrow">QUIÉN LLEVA QUÉ</p><h3>Lista colaborativa</h3></div><button onClick={()=>setQuick({type:"item",open:true})}><Plus/></button></div>{plan.items.map((x:any)=><button className="bring-row" key={x.id} onClick={async()=>{await claimPlanItem(x.id,!x.claimed_by);refresh()}}><span>{x.claimed_by?<Check/>:<Plus/>}</span><b>{x.label}</b><small>{x.profiles?.name||"Me anoto"}</small></button>)}{!plan.items.length&&<p className="detail-empty">Agregá bebidas, comida o cualquier cosa necesaria.</p>}</article>
        <article className="detail-card edge"><div className="detail-card-head"><div><p className="eyebrow">TRANSPORTE</p><h3>¿Cómo llega cada uno?</h3></div><Car size={17}/></div><div className="transport-choices">{[["car","🚗 Auto"],["rideshare","🚕 Uber"],["walk","🚶 Caminando"],["bus","🚌 Colectivo"],["bike","🚲 Bici"]].map(([mode,label])=><button key={mode} onClick={async()=>{await setPlanTransport(id,mode,mode==="car"?3:0);refresh()}}>{label}</button>)}</div>{plan.transport.map((x:any)=><div className="transport-row" key={x.user_id}><Avatar initials={initials(x.profiles.name)} color={x.profiles.avatar_color} src={x.profiles.avatar_url} small/><b>{x.profiles.name}</b><span>{x.mode}{x.seats_available?` · ${x.seats_available} lugares`:""}</span></div>)}</article>
      </div>}
      {tab==="polls"&&<><button className="inline-create" onClick={()=>{setQuickError("");setPollOptions(["",""]);setQuick({type:"poll",open:true})}}><Plus/> Nueva encuesta</button><div className="poll-grid">{plan.polls.map((poll:any)=><article className="detail-card edge" key={poll.id}><div className="poll-title"><div><p className="eyebrow">ENCUESTA</p><h3>{poll.question}</h3></div>{(poll.created_by===user?.id||plan.created_by===user?.id)&&<button onClick={async()=>{await deletePoll(poll.id);refresh()}} aria-label="Eliminar encuesta"><Trash2/></button>}</div><div className="poll-options">{poll.poll_options.map((o:any)=>{const votes=o.poll_votes.length;const mine=o.poll_votes.some((v:any)=>v.user_id===user?.id);return <button className={mine?"voted":""} key={o.id} onClick={async()=>{await votePoll(o.id);refresh()}}><span>{mine&&"✓ "}{o.emoji} {o.label}</span><b>{votes}</b><i style={{width:`${Math.min(100,votes/Math.max(1,plan.plan_members.length)*100)}%`}}/></button>})}</div></article>)}</div>{!plan.polls.length&&<div className="empty-state edge"><span className="empty-emoji">🗳️</span><h3>Decidan juntos</h3><p>Creá una votación para elegir comida, lugar, horario o actividad.</p></div>}</>}
      {tab==="budget"&&<><div className="budget-total edge"><span>Total estimado</span><b>${plan.expenses.reduce((s:number,e:any)=>s+Number(e.amount),0).toLocaleString("es-AR")}</b><small>${Math.round(plan.expenses.reduce((s:number,e:any)=>s+Number(e.amount),0)/Math.max(1,stats.going)).toLocaleString("es-AR")} por confirmado</small></div><button className="inline-create" onClick={()=>setQuick({type:"expense",open:true})}><Plus/> Agregar gasto</button><div className="expense-list">{plan.expenses.map((e:any)=><div className="expense-row edge" key={e.id}><span><CircleDollarSign/></span><div><b>{e.label}</b><small>Pagó {e.profiles?.name||"—"}</small></div><strong>${Number(e.amount).toLocaleString("es-AR")}</strong></div>)}</div></>}
      {tab==="chat"&&<div className="chat-panel edge"><div className="messages">{plan.messages.map((m:any)=><div className="message" key={m.id}><Avatar initials={initials(m.profiles.name)} color={m.profiles.avatar_color} src={m.profiles.avatar_url} small/><div><span><b>{m.profiles.name}</b><small>{new Date(m.created_at).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</small></span><p>{m.body}</p></div></div>)}{!plan.messages.length&&<p className="detail-empty">El chat arranca con el primer mensaje.</p>}</div><div className="chat-composer"><input value={composer} onChange={e=>setComposer(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Escribí un mensaje…"/><button onClick={send}><Send/></button></div></div>}
      {tab==="memories"&&<div className="memories-layout"><div className="photos-head"><div><h3>Fotos del Planardo</h3><p>Un álbum privado para quienes participaron.</p></div><button className="inline-create" onClick={()=>photoRef.current?.click()}><ImagePlus/> Subir foto</button><input ref={photoRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const f=e.target.files?.[0];if(f){await uploadPlanPhoto(id,f);refresh()}}}/></div>{plan.photos.length?<div className="photo-grid">{plan.photos.map((p:any)=><img src={p.url} alt={p.caption||"Foto del Planardo"} key={p.id}/>)}</div>:<div className="empty-state edge"><span className="empty-emoji">📷</span><h3>El álbum está vacío</h3><p>Subí la primera foto de este Planardo.</p></div>}<div className="comments-card edge"><h3>Comentarios</h3>{plan.comments.map((c:any)=><div className="comment-row" key={c.id}><Avatar initials={initials(c.profiles.name)} color={c.profiles.avatar_color} src={c.profiles.avatar_url} small/><div><b>{c.profiles.name}</b><p>{c.body}</p></div></div>)}<div className="chat-composer"><input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Dejá un comentario…"/><button onClick={async()=>{if(comment.trim()){await addPlanComment(id,comment);setComment("");refresh()}}}><Send/></button></div></div></div>}
    </motion.div></AnimatePresence>

    <AnimatePresence>{quick.open&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="quick-modal edge" initial={{scale:.96,y:12}} animate={{scale:1,y:0}}><div className="modal-head"><div><p className="eyebrow">AGREGAR</p><h2>{quick.type==="check"?"Nueva tarea":quick.type==="item"?"¿Qué hay que llevar?":quick.type==="timeline"?"Actividad":quick.type==="expense"?"Nuevo gasto":"Nueva encuesta"}</h2></div><button onClick={()=>setQuick({type:"",open:false})}><X/></button></div><label className="quick-field"><span>{quick.type==="poll"?"Pregunta":"Nombre"}</span><input autoFocus value={field} onChange={e=>setField(e.target.value)}/></label>{["timeline","expense"].includes(quick.type)&&<label className="quick-field"><span>{quick.type==="timeline"?"Fecha y hora":"Importe"}</span><input type={quick.type==="timeline"?"datetime-local":"number"} value={field2} onChange={e=>setField2(e.target.value)}/></label>}{quick.type==="poll"&&<div className="poll-option-fields"><span className="quick-field-label">Opciones</span>{pollOptions.map((opt,i)=><div className="poll-option-row" key={i}><input value={opt} placeholder={`Opción ${i+1}`} onChange={e=>setPollOptions(list=>list.map((v,idx)=>idx===i?e.target.value:v))}/>{pollOptions.length>2&&<button type="button" className="poll-option-remove" onClick={()=>setPollOptions(list=>list.filter((_,idx)=>idx!==i))} aria-label="Quitar opción"><X size={14}/></button>}</div>)}<button type="button" className="poll-option-add" onClick={()=>setPollOptions(list=>[...list,""])}><Plus size={14}/> Agregar opción</button></div>}{quickError&&<p className="quick-error">{quickError}</p>}<button className="create-submit" disabled={quickSaving} onClick={submitQuick}>{quickSaving?"Guardando…":"Agregar"} <ChevronRight/></button></motion.div></motion.div>}</AnimatePresence>
    <AnimatePresence>{conflicts.length>0&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="conflict-modal edge" initial={{scale:.96,y:12}} animate={{scale:1,y:0}}><span className="conflict-icon">!</span><h2>Ya tenés otro plan</h2><p>Para cuidar tu agenda, no podés confirmar dos Planardos superpuestos.</p>{conflicts.map(c=><div className="conflict-plan" key={c.id}><b>{c.emoji} {c.name}</b><small>{cap(new Date(c.starts_at).toLocaleString("es-AR",{weekday:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}))}</small></div>)}<button className="create-submit" onClick={()=>setConflicts([])}>Entendido</button></motion.div></motion.div>}</AnimatePresence>
    <AnimatePresence>{confirmDelete&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="delete-group-modal edge" initial={{scale:.96,y:12}} animate={{scale:1,y:0}}><span><XCircle/></span><h2>¿Dar de baja este Planardo?</h2><p>Dejará de aparecer como plan activo y liberará la disponibilidad de todos. Conservaremos sus datos como registro.</p><div><button onClick={()=>setConfirmDelete(false)}>Volver</button><button className="danger" onClick={async()=>{await cancelPlan(id);onDeleted?.();onBack()}}>Dar de baja</button></div></motion.div></motion.div>}</AnimatePresence>

    <AnimatePresence>{editOpen&&editForm&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>e.target===e.currentTarget&&setEditOpen(false)}><motion.div className="modal edge" initial={{opacity:0,y:30,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:30,scale:.97}} transition={{type:"spring",damping:26,stiffness:300}}>
      <div className="modal-handle"/>
      <div className="modal-head"><div><p className="eyebrow">EDITAR</p><h2>Editá tu Planardo</h2></div><button onClick={()=>setEditOpen(false)}><X/></button></div>
      <div className="form">
        <label className="main-input"><span className="emoji-picker">{editForm.emoji}</span><input autoFocus placeholder="¿Qué plan pinta?" value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})}/></label>
        <div className="field-row">
          <label><span><CalendarDays size={17}/> Fecha</span><input type="date" value={editForm.date} onChange={e=>setEditForm({...editForm,date:e.target.value})}/></label>
          <label><span><Clock3 size={17}/> Hora</span><input type="time" value={editForm.time} onChange={e=>setEditForm({...editForm,time:e.target.value})}/></label>
        </div>
        <div className="field-row">
          <label><span><CalendarDays size={17}/> Finaliza (opcional)</span><input type="date" min={editForm.date} value={editForm.end_date} onChange={e=>setEditForm({...editForm,end_date:e.target.value})}/></label>
          <label><span><Clock3 size={17}/> Hora final</span><input type="time" value={editForm.end_time} onChange={e=>setEditForm({...editForm,end_time:e.target.value})}/></label>
        </div>
        <label className="field"><span><Vote size={17}/> Tipo de plan</span><select value={editForm.plan_type} onChange={e=>setEditForm({...editForm,plan_type:e.target.value})}>{PLAN_TYPES.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
        <label className="field"><span><MapPin size={17}/> Lugar</span><input placeholder="¿Dónde se juntan?" value={editForm.place_name} onChange={e=>setEditForm({...editForm,place_name:e.target.value})}/></label>
        <label className="field"><span><MapPin size={17}/> Link de ubicación</span><input type="url" placeholder="https://maps.google.com/…" value={editForm.location_url} onChange={e=>setEditForm({...editForm,location_url:e.target.value})}/></label>
        <label className="field"><span>Descripción</span><input placeholder="Contales de qué se trata" value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})}/></label>
        <label className="field"><span>Nota importante</span><input placeholder="Algo que no se puedan perder" value={editForm.notes} onChange={e=>setEditForm({...editForm,notes:e.target.value})}/></label>
        <div className="color-select"><span>Color del plan</span><div>{PLAN_COLORS.map(c=><button type="button" key={c} onClick={()=>setEditForm({...editForm,color:c})} className={editForm.color===c?"selected":""} style={{background:c}}>{editForm.color===c&&<Check/>}</button>)}</div></div>
        <button className="create-submit" disabled={editSaving||!editForm.name.trim()||!editForm.date} onClick={saveEdit}>{editSaving?"Guardando…":"Guardar cambios"} <Check size={18}/></button>
      </div>
    </motion.div></motion.div>}</AnimatePresence>
  </section>
}
