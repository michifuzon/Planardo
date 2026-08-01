"use client";

import { Check, Search, UserMinus, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchFriendships, removeFriend, respondFriendRequest, searchPeople, sendFriendRequest } from "@/lib/friends";
import type { FullProfile } from "@/lib/profiles";
import Avatar from "./Avatar";

function initials(name:string){ return name.slice(0,2).toUpperCase(); }

export default function FriendsView({ onOpenProfile }: { onOpenProfile?: (id: string) => void }) {
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<FullProfile[]>([]);
  const [relationships,setRelationships]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [removeTarget,setRemoveTarget]=useState<any>(null);
  const refresh=useCallback(()=>fetchFriendships().then(setRelationships).catch(()=>setRelationships([])),[]);
  useEffect(()=>{ refresh().finally(()=>setLoading(false)); },[refresh]);
  useEffect(()=>{
    if(query.trim().length<2){setResults([]);return;}
    const timer=window.setTimeout(()=>searchPeople(query.trim()).then(setResults).catch(()=>setResults([])),300);
    return()=>window.clearTimeout(timer);
  },[query]);

  async function add(id:string){ try{await sendFriendRequest(id);setMessage("Solicitud enviada ✨");setResults([]);setQuery("");refresh();}catch(e){setMessage(e instanceof Error?e.message:"No se pudo enviar.");} }
  async function answer(id:string,accept:boolean){await respondFriendRequest(id,accept);refresh();}
  async function confirmRemove(){
    if(!removeTarget)return;
    try{
      await removeFriend(removeTarget.requester_id,removeTarget.addressee_id);
      setMessage(`${removeTarget.person.name} ya no está en tus amigos.`);
      setRemoveTarget(null);refresh();
    }catch{setMessage("No se pudo quitar a esta persona. Probá de nuevo.");}
  }
  const friends=relationships.filter(r=>r.status==="accepted");
  const pending=relationships.filter(r=>r.status==="pending"&&r.incoming);

  return <section className="friends-view">
    <div className="greeting"><div><p className="eyebrow">TU RED</p><h1>Amigos</h1><p>También podés conectar sin compartir un grupo.</p></div></div>
    <div className="people-search edge">
      <Search size={18}/><input placeholder="Buscar por nombre o @username" value={query} onChange={e=>setQuery(e.target.value)}/>
    </div>
    {results.length>0&&<div className="search-results edge">{results.map(p=><div key={p.id}><Avatar initials={initials(p.name)} color={p.avatar_color} src={p.avatar_url}/><span><b>{p.name}</b><small>@{p.username}</small></span><button onClick={()=>add(p.id)}><UserPlus size={15}/> Agregar</button></div>)}</div>}
    {message&&<p className="friends-message">{message}</p>}
    {pending.length>0&&<><div className="section-title compact"><div><h2>Solicitudes</h2><p>{pending.length} esperando tu respuesta</p></div></div><div className="people-list">{pending.map(r=><div className="person-card edge" key={r.person.id}><Avatar initials={initials(r.person.name)} color={r.person.avatar_color} src={r.person.avatar_url}/><span><b>{r.person.name}</b><small>@{r.person.username}</small></span><div><button className="accept" onClick={()=>answer(r.requester_id,true)}><Check/></button><button onClick={()=>answer(r.requester_id,false)}><X/></button></div></div>)}</div></>}
    <div className="section-title compact"><div><h2>Tus amigos</h2><p>{loading?"Cargando…":`${friends.length} conexiones`}</p></div></div>
    {loading?<p className="groups-status">Cargando tus amigos…</p>:friends.length?<div className="people-list">{friends.map(r=><div className="person-card edge" key={r.person.id} onClick={()=>onOpenProfile?.(r.person.id)} style={onOpenProfile?{cursor:"pointer"}:undefined}><Avatar initials={initials(r.person.name)} color={r.person.avatar_color} src={r.person.avatar_url}/><span><b>{r.person.name}</b><small>@{r.person.username}</small></span><button className="remove-friend" onClick={(e)=>{e.stopPropagation();setRemoveTarget(r)}} title="Quitar amigo"><UserMinus/></button></div>)}</div>:<div className="empty-state edge"><span className="empty-emoji">👋</span><h3>Tu lista está lista para crecer</h3><p>Buscá a alguien por su username y mandale una solicitud.</p></div>}
    {removeTarget&&<div className="confirm-remove edge"><div><b>¿Quitar a {removeTarget.person.name}?</b><p>Dejarán de aparecer como amigos, pero seguirán compartiendo los grupos donde ambos estén.</p></div><button onClick={()=>setRemoveTarget(null)}>Cancelar</button><button className="danger" onClick={confirmRemove}>Quitar</button></div>}
  </section>;
}
