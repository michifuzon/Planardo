"use client";

import { Check, LockKeyhole, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchGroupAvailability } from "@/lib/availability";
import type { Group } from "@/lib/groups";
import Avatar from "./Avatar";

const initials=(name:string)=>name.slice(0,2).toUpperCase();
const dayStart=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate());

export default function AvailabilityView({groups}:{groups:Group[]}){
  const [groupId,setGroupId]=useState(groups[0]?.id||"");
  const [busy,setBusy]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const dates=useMemo(()=>{
    const start=dayStart(new Date());
    return Array.from({length:7},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
  },[]);
  useEffect(()=>{if(!groupId&&groups[0])setGroupId(groups[0].id)},[groups,groupId]);
  useEffect(()=>{
    if(!groupId)return;
    setLoading(true);
    const until=new Date(dates[6]);until.setDate(until.getDate()+1);
    fetchGroupAvailability(groupId,dates[0],until).then(setBusy).catch(()=>setBusy([])).finally(()=>setLoading(false));
  },[groupId,dates]);
  const selected=groups.find(g=>g.id===groupId);
  const members=selected?.members||[];
  const isBusy=(userId:string,day:Date)=>{
    const from=dayStart(day),until=new Date(from);until.setDate(until.getDate()+1);
    return busy.some(row=>row.user_id===userId&&row.busy_from&&new Date(row.busy_from)<until&&new Date(row.busy_until)>from);
  };
  const scores=dates.map(day=>({day,free:members.filter(m=>!isBusy(m.id,day)).length}));
  const best=[...scores].sort((a,b)=>b.free-a.free)[0];

  if(!groups.length)return <div className="empty-state edge"><span className="empty-emoji">👥</span><h3>Primero necesitás un grupo</h3><p>La disponibilidad compartida aparece cuando hay integrantes para comparar.</p></div>;
  return <section className="availability-smart">
    <div className="availability-toolbar"><label><span>Disponibilidad de</span><select value={groupId} onChange={e=>setGroupId(e.target.value)}>{groups.map(g=><option value={g.id} key={g.id}>{g.emoji} {g.name}</option>)}</select></label><span className="privacy-note"><LockKeyhole/> Solo se comparte ocupado o libre</span></div>
    <div className="best-date edge"><span><Sparkles/></span><div><p className="eyebrow">MEJOR FECHA AUTOMÁTICA</p><h2>{best&&members.length?`${best.day.toLocaleDateString("es-AR",{weekday:"long",day:"numeric"})}: ${best.free} de ${members.length} pueden`:"Calculando disponibilidad…"}</h2><p>Los detalles de planes pertenecientes a otros grupos permanecen privados.</p></div></div>
    <div className="group-availability-matrix edge">
      <div className="matrix-head"><span>Persona</span>{dates.map(d=><time key={d.toDateString()}><small>{d.toLocaleDateString("es-AR",{weekday:"short"}).toUpperCase()}</small><b>{d.getDate()}</b></time>)}</div>
      {members.map(member=><div className="matrix-row" key={member.id}><span><Avatar initials={initials(member.name)} color={member.avatar_color} src={member.avatar_url} small/><b>{member.name}</b></span>{dates.map(d=>{const occupied=isBusy(member.id,d);return <i title={occupied?"Ocupado":"Disponible"} className={occupied?"busy":"free"} key={d.toDateString()}>{occupied?"×":<Check/>}</i>})}</div>)}
      {loading&&<div className="matrix-loading">Actualizando…</div>}
    </div>
  </section>
}
