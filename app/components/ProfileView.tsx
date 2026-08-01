"use client";

import { Camera, Check, LoaderCircle, Save, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchMyProfile, fetchMyStats, updateMyProfile, usernameAvailable, type FullProfile } from "@/lib/profiles";
import AvatarCropper from "./AvatarCropper";

export default function ProfileView({ fallbackName, email, groupCount, friendCount, onChanged }: {
  fallbackName: string; email?: string; groupCount: number; friendCount: number; onChanged?: (profile: FullProfile) => void;
}) {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [name, setName] = useState(fallbackName);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState<"loading"|"idle"|"saving"|"saved"|"error">("loading");
  const [message, setMessage] = useState("");
  const [stats,setStats]=useState({groups:groupCount,friends:friendCount});
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSource,setCropSource]=useState<File>();

  useEffect(() => {
    fetchMyProfile().then((p) => {
      setProfile(p); setName(p.name); setUsername(p.username); setBio(p.bio || ""); setStatus("idle");
    }).catch(() => { setStatus("error"); setMessage("Primero ejecutá la migración 0002 en Supabase."); });
    fetchMyStats().then(setStats).catch(()=>{});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
    if (clean.length < 3) return setMessage("El username necesita al menos 3 caracteres.");
    setStatus("saving"); setMessage("");
    try {
      if (!(await usernameAvailable(clean))) throw new Error("Ese username ya está ocupado.");
      const updated = await updateMyProfile({ name: name.trim(), username: clean, bio: bio.trim(), avatarFile: file });
      setProfile(updated); setUsername(updated.username); setStatus("saved"); setMessage("Perfil actualizado");
      onChanged?.(updated);
      window.setTimeout(() => setStatus("idle"), 2200);
    } catch (err) {
      setStatus("error"); setMessage(err instanceof Error ? err.message : "No pudimos guardar.");
    }
  }

  async function shareProfile() {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${profile.id}`);
      setStatus("saved"); setMessage("Link de tu perfil copiado — mandaselo a quien querés que te agregue 📋");
      window.setTimeout(() => { setStatus("idle"); setMessage(""); }, 3200);
    } catch {
      setStatus("error"); setMessage("No se pudo copiar el link.");
    }
  }

  async function saveAvatar(next: File) {
    setFile(next);
    setPreview(URL.createObjectURL(next));
    if (!username || !name.trim()) return;
    setStatus("saving");
    setMessage("Subiendo foto…");
    try {
      const updated=await updateMyProfile({name:name.trim(),username,bio:bio.trim(),avatarFile:next});
      setProfile(updated);
      setPreview(updated.avatar_url||"");
      setFile(undefined);
      setStatus("saved");
      setMessage("Foto actualizada");
      onChanged?.(updated);
      window.setTimeout(()=>{setStatus("idle");setMessage("")},2200);
    } catch(error) {
      const raw=error as {message?:string};
      setStatus("error");
      setMessage(raw?.message||"No se pudo subir la foto.");
    }
  }

  return (
    <section className="profile-view">
      <div className="greeting"><div><p className="eyebrow">TU IDENTIDAD EN PLANARDO</p><h1>Tu perfil</h1><p>Así te encuentra y reconoce tu gente.</p></div></div>
      <form className="profile-panel edge" onSubmit={save}>
        <div className="profile-hero">
          <button type="button" className="profile-photo" onClick={() => inputRef.current?.click()}>
            <span className="profile-avatar-frame">
              {preview || profile?.avatar_url
                ? <img src={preview || profile?.avatar_url || ""} alt="Foto de perfil"/>
                : <b>{name.slice(0,2).toUpperCase()}</b>}
            </span>
            <span className="profile-camera"><Camera size={15}/></span>
          </button>
          <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>{const selected=e.target.files?.[0];if(selected)setCropSource(selected);e.currentTarget.value="";}}/>
          <div><h2>{name || fallbackName}</h2><p>@{username || "tu_username"} · {email}</p></div>
          <div className="profile-stats"><span><b>{stats.groups}</b> grupos</span><span><b>{stats.friends}</b> amigos</span></div>
        </div>
        {profile && <button type="button" className="inline-create share-profile-btn" onClick={shareProfile}><Share2 size={14}/> Compartir mi perfil</button>}
        <div className="profile-fields">
          <label><span>Nombre</span><input value={name} onChange={(e)=>setName(e.target.value)} maxLength={50}/></label>
          <label><span>Username único</span><div className="username-input"><i>@</i><input value={username} onChange={(e)=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))} minLength={3} maxLength={24}/></div></label>
          <label className="profile-bio"><span>Bio</span><textarea value={bio} onChange={(e)=>setBio(e.target.value)} placeholder="Contá algo sobre vos…" maxLength={120}/></label>
        </div>
        {message && <p className={`profile-message ${status==="error"?"error":""}`}>{status==="saved"&&<Check size={14}/>} {message}</p>}
        <button className="create-submit profile-save" disabled={status==="saving"||status==="loading"}>
          {status==="saving"?<><LoaderCircle className="auth-spin" size={17}/> Guardando…</>:<><Save size={17}/> Guardar perfil</>}
        </button>
      </form>
      {cropSource&&<AvatarCropper file={cropSource} onCancel={()=>setCropSource(undefined)} onConfirm={file=>{setCropSource(undefined);void saveAvatar(file)}}/>}
    </section>
  );
}
