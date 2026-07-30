"use client";

import { Check, Search, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchFriendships, respondFriendRequest, searchPeople, sendFriendRequest } from "@/lib/friends";
import type { FullProfile } from "@/lib/profiles";
import Avatar from "./Avatar";

function initials(name:string){ return name.slice(0,2).toUpperCase(); }

export default function FriendsView() {
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<FullProfile[]>([]);
  const [relationships,setRelationships]=useState<any[]>([]);
  const [message,setMessage]=useState("");
  const refresh=useCallback(()=>fetchFriendships().then(setRelationships).catch(()=>setRelationships([])),[]);
  useEffect(()=>{ refresh(); },[refresh]);
  useEffect(()=>{
    if(query.trim().length<2){setResults([]);return;}
    const timer=window.setTimeout(()=>searchPeople(query.trim()).then(setResults).catch(()=>setResults([])),300);
    return()=>window.clearTimeout(timer);
  },[query]);

  async function add(id:string){ try{await sendFriendRequest(id);setMessage("Solicitud enviada ✨");setResults([]);setQuery("");refresh();}catch(e){setMessage(e instanceof Error?e.message:"No se pudo enviar.");} }
  async function answer(id:string,accept:boolean){await respondFriendRequest(id,accept);refresh();}
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
    <div className="section-title compact"><div><h2>Tus amigos</h2><p>{friends.length} conexiones</p></div></div>
    {friends.length?<div className="people-list">{friends.map(r=><div className="person-card edge" key={r.person.id}><Avatar initials={initials(r.person.name)} color={r.person.avatar_color} src={r.person.avatar_url}/><span><b>{r.person.name}</b><small>@{r.person.username}</small></span><i className="friend-ok"><Check/></i></div>)}</div>:<div className="empty-state edge"><span className="empty-emoji">👋</span><h3>Tu lista está lista para crecer</h3><p>Buscá a alguien por su username y mandale una solicitud.</p></div>}
  </section>;
}
