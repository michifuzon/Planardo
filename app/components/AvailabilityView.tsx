"use client";

import { Check, ChevronLeft, ChevronRight, LockKeyhole, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchGroupAvailability } from "@/lib/availability";
import type { Group } from "@/lib/groups";
import { cap } from "@/lib/format";
import Avatar from "./Avatar";

const initials=(name:string)=>name.slice(0,2).toUpperCase();
const dayStart=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate());

export default function AvailabilityView({groups,plans=[],onSelectPlan}:{groups:Group[];plans?:any[];onSelectPlan?:(id:string)=>void}){
  const [groupId,setGroupId]=useState(groups[0]?.id||"");
  const [month,setMonth]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
  const [selectedDay,setSelectedDay]=useState<Date|null>(null);
  const [busy,setBusy]=useState<any[]>([]);
  const [busyForGroup,setBusyForGroup]=useState("");
  const [loading,setLoading]=useState(false);

  const week=useMemo(()=>{
    const start=dayStart(new Date());
    return Array.from({length:7},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
  },[]);
  const days=useMemo(()=>{
    const year=month.getFullYear(),m=month.getMonth();
    const count=new Date(year,m+1,0).getDate();
    const offset=(new Date(year,m,1).getDay()+6)%7;
    const cells=Math.ceil((offset+count)/7)*7;
    return Array.from({length:cells},(_,i)=>{
      const day=i-offset+1;
      return day>=1&&day<=count?new Date(year,m,day):null;
    });
  },[month]);

  useEffect(()=>{if(!groupId&&groups[0])setGroupId(groups[0].id)},[groups,groupId]);
  useEffect(()=>{
    if(!groupId)return;
    setLoading(true);
    const from=new Date(month.getFullYear(),month.getMonth(),1);
    const until=new Date(month.getFullYear(),month.getMonth()+1,1);
    const forGroup=groupId;
    fetchGroupAvailability(groupId,from,until)
      .then(rows=>{setBusy(rows);setBusyForGroup(forGroup)})
      .catch(()=>{setBusy([]);setBusyForGroup(forGroup)})
      .finally(()=>setLoading(false));
  },[groupId,month]);

  const selected=groups.find(g=>g.id===groupId);
  const members=selected?.members||[];
  const dataReady=busyForGroup===groupId;
  const busyRangesOn=(userId:string,day:Date)=>{
    const from=dayStart(day),until=new Date(from);until.setDate(until.getDate()+1);
    return busy.filter(row=>row.user_id===userId&&row.busy_from&&new Date(row.busy_from)<until&&new Date(row.busy_until)>from)
      .map(row=>({from:new Date(row.busy_from),to:new Date(row.busy_until),planName:row.plan_name as string|null,planEmoji:row.plan_emoji as string|null}));
  };
  const isBusy=(userId:string,day:Date)=>busyRangesOn(userId,day).length>0;
  const fmtTime=(d:Date)=>d.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
  const busyLabel=(userId:string,day:Date)=>{
    const from=dayStart(day),until=new Date(from);until.setDate(until.getDate()+1);
    const ranges=busyRangesOn(userId,day);
    if(!ranges.length)return "Disponible todo el día";
    return ranges.map(r=>{
      if(r.planName)return `Va a ${r.planEmoji||"🎉"} ${r.planName}`;
      const fullDay=r.from<=from&&r.to>=until;
      return fullDay?"Ocupado todo el día":`Ocupado ${fmtTime(r.from<from?from:r.from)}–${fmtTime(r.to>until?until:r.to)}`;
    }).join(" · ");
  };
  const freeOn=(day:Date)=>members.filter(m=>!isBusy(m.id,day));
  const scores=week.map(day=>({day,free:freeOn(day).length}));
  const best=[...scores].sort((a,b)=>b.free-a.free)[0];
  const groupPlansOnDay=(day:Date)=>{
    const from=dayStart(day),until=new Date(from);until.setDate(until.getDate()+1);
    return plans.filter((p:any)=>{
      if(p.group_id!==groupId)return false;
      const start=new Date(p.starts_at),end=p.ends_at?new Date(p.ends_at):start;
      return start<until&&end>=from;
    });
  };

  if(!groups.length)return <div className="empty-state edge"><span className="empty-emoji">👥</span><h3>Primero necesitás un grupo</h3><p>La disponibilidad compartida aparece cuando hay integrantes para comparar.</p></div>;
  return <section className="availability-smart">
    <div className="availability-toolbar">{groups.length>1?<label><span>Disponibilidad de</span><select value={groupId} onChange={e=>{setGroupId(e.target.value);setSelectedDay(null)}}>{groups.map(g=><option value={g.id} key={g.id}>{g.emoji} {g.name}</option>)}</select></label>:<span className="availability-toolbar-title">Disponibilidad de {selected?.emoji} {selected?.name}</span>}<span className="privacy-note"><LockKeyhole/> Solo se comparte ocupado o libre</span></div>
    <div className="best-date edge"><span><Sparkles/></span><div><p className="eyebrow">MEJOR FECHA AUTOMÁTICA</p><h2>{dataReady&&best&&members.length?`${cap(best.day.toLocaleDateString("es-AR",{weekday:"long",day:"numeric"}))}: ${best.free}/${members.length} pueden`:"Calculando disponibilidad…"}</h2><p>Los detalles de planes pertenecientes a otros grupos permanecen privados.</p></div></div>

    <section className="calendar-section availability-calendar">
      <div className="calendar-card edge">
        <div className="calendar-header">
          <div><p className="eyebrow">{cap(month.toLocaleDateString("es-AR",{month:"long"}))}</p><h2>{month.getFullYear()}</h2></div>
          <div className="calendar-nav"><button onClick={()=>{setMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1));setSelectedDay(null)}}><ChevronLeft/></button><button onClick={()=>{setMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1));setSelectedDay(null)}}><ChevronRight/></button></div>
        </div>
        <div className="weekdays">{["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"].map(d=><span key={d}>{d}</span>)}</div>
        <div className="calendar-grid">
          {days.map((day,i)=>{
            if(day===null)return <div className="day muted" key={i}/>;
            const free=dataReady?freeOn(day):[];
            const dayPlans=groupPlansOnDay(day);
            return (
              <button key={i} onClick={()=>setSelectedDay(day)} className={`day ${selectedDay?.toDateString()===day.toDateString()?"selected":""} ${day.toDateString()===new Date().toDateString()?"today":""} ${dayPlans.length?"day-has-plan":""}`}>
                <span className="day-number">{day.getDate()}</span>
                {dayPlans.length>0?(
                  <span className="day-plan-badge" style={{background:dayPlans[0].color}} title={dayPlans[0].name}>{dayPlans[0].emoji}</span>
                ):dataReady&&members.length>0&&(
                  <span className="mini-avatars">
                    {free.slice(0,3).map(m=><Avatar key={m.id} initials={initials(m.name)} color={m.avatar_color} src={m.avatar_url} small/>)}
                    {free.length>3&&<i className="mini-avatars-more">+{free.length-3}</i>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <aside className="day-detail edge">
        {selectedDay?(
          <>
            <div className="day-detail-head"><div><p className="eyebrow">{cap(selectedDay.toLocaleDateString("es-AR",{weekday:"long"}))}</p><h3>{cap(selectedDay.toLocaleDateString("es-AR",{day:"numeric",month:"long"}))}</h3></div><button onClick={()=>setSelectedDay(null)}><X size={18}/></button></div>
            {groupPlansOnDay(selectedDay).length>0&&(
              <div className="day-plan-list">
                {groupPlansOnDay(selectedDay).map((p:any)=>(
                  <button key={p.id} className="day-plan-row" onClick={()=>onSelectPlan?.(p.id)} disabled={!onSelectPlan}>
                    <span className="day-plan-emoji" style={{background:p.color}}>{p.emoji}</span>
                    <span><b>{p.name}</b><small>{new Date(p.starts_at).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</small></span>
                  </button>
                ))}
              </div>
            )}
            {members.length?(
              <div className="availability-list">
                {members.map(m=>{
                  const occupied=dataReady&&isBusy(m.id,selectedDay);
                  return <div key={m.id}><Avatar initials={initials(m.name)} color={m.avatar_color} src={m.avatar_url} small/><span><b>{m.name}</b><small>{!dataReady?"Cargando…":busyLabel(m.id,selectedDay)}</small></span><i className={occupied?"busy":""}/></div>;
                })}
              </div>
            ):<p className="availability-note">Este grupo todavía no tiene integrantes.</p>}
          </>
        ):(
          <p className="availability-note">Tocá un día para ver quién está disponible.</p>
        )}
      </aside>
    </section>
  </section>
}
