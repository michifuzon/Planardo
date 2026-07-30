"use client";

import { Check, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAvailability, setAvailability } from "@/lib/availability";
import Avatar from "./Avatar";

const iso=(d:Date)=>d.toISOString().slice(0,10);
export default function AvailabilityView(){
  const start=useMemo(()=>{const d=new Date();d.setHours(12,0,0,0);return d},[]);
  const dates=useMemo(()=>Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d}),[start]);
  const [rows,setRows]=useState<any[]>([]);
  const load=useCallback(()=>fetchAvailability(iso(dates[0]),iso(dates[6])).then(setRows).catch(()=>setRows([])),[dates]);
  useEffect(()=>{load()},[load]);
  const counts=dates.map(d=>({date:d,available:rows.filter(r=>r.day===iso(d)&&r.status==="available"),maybe:rows.filter(r=>r.day===iso(d)&&r.status==="maybe")}));
  const best=[...counts].sort((a,b)=>(b.available.length+b.maybe.length*.5)-(a.available.length+a.maybe.length*.5))[0];
  async function choose(day:string,status:"available"|"maybe"|"busy"){await setAvailability(day,status);load()}
  return <section className="availability-smart">
    <div className="best-date edge"><span><Sparkles/></span><div><p className="eyebrow">MEJOR FECHA AUTOMÁTICA</p><h2>{best.available.length?`${best.date.toLocaleDateString("es-AR",{weekday:"long",day:"numeric"})} es el mejor día`:"Marcá cuándo podés"}</h2><p>{best.available.length?`${best.available.length} personas disponibles${best.maybe.length?` · ${best.maybe.length} tal vez`:""}`:"Cuando tu grupo responda, PLANARDO destacará la mejor coincidencia."}</p></div></div>
    <div className="availability-week">{counts.map((x,i)=><article className={`availability-day-card edge ${iso(x.date)===iso(best.date)&&best.available.length?"best":""}`} key={iso(x.date)}>
      {iso(x.date)===iso(best.date)&&best.available.length>0&&<span className="best-badge"><Check/> MEJOR</span>}
      <time><small>{i===0?"HOY":x.date.toLocaleDateString("es-AR",{weekday:"short"}).toUpperCase()}</small><b>{x.date.getDate()}</b></time>
      <div className="availability-faces">{x.available.slice(0,4).map((r:any)=><Avatar key={r.user_id} initials={r.profiles.name.slice(0,2).toUpperCase()} color={r.profiles.avatar_color} src={r.profiles.avatar_url} small/>)}{!x.available.length&&<span>—</span>}</div>
      <p>{x.available.length} disponibles</p>
      <div className="availability-actions"><button onClick={()=>choose(iso(x.date),"available")} title="Disponible">●</button><button onClick={()=>choose(iso(x.date),"maybe")} title="Tal vez">●</button><button onClick={()=>choose(iso(x.date),"busy")} title="Ocupado">●</button></div>
    </article>)}</div>
  </section>
}
