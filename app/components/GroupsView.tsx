"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Link as LinkIcon, Plus, Trash2, Users, X } from "lucide-react";
import { useState } from "react";
import { createGroup, createInvite, deleteGroup, type Group } from "@/lib/groups";
import Avatar from "./Avatar";
import { useAuth } from "./AuthProvider";

const EMOJIS = ["👥", "💙", "🎉", "🏠", "🌮", "⚡", "🎮", "⭐"];
const COLORS = ["#8b5cf6", "#f97316", "#06b6d4", "#22c55e", "#ec4899"];

function initialsOf(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default function GroupsView({
  groups,
  loading,
  onRefresh,
}: {
  groups: Group[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [description,setDescription]=useState("");
  const [photo,setPhoto]=useState<File>();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastError,setToastError]=useState(false);
  const [deleteTarget,setDeleteTarget]=useState<Group|null>(null);
  const {user}=useAuth();

  function showToast(msg: string, error = false) {
    setToast(msg);
    setToastError(error);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createGroup(name.trim(), emoji, color, description.trim(), photo);
      setCreateOpen(false);
      setName("");
      setEmoji(EMOJIS[0]);
      setColor(COLORS[0]);
      setDescription("");
      setPhoto(undefined);
      onRefresh();
      showToast("Grupo creado 🎉");
    } catch (err) {
      const raw = err as { message?: string; details?: string; hint?: string };
      const msg = err instanceof Error ? err.message : raw?.message || raw?.details || raw?.hint || "Error desconocido";
      console.error("createGroup failed:", err);
      showToast(`No se pudo crear el grupo. ${msg}`, true);
    } finally {
      setSaving(false);
    }
  }

  async function handleInvite(groupId: string) {
    try {
      const invite = await createInvite(groupId);
      const url = `${window.location.origin}/join/${invite.code}`;
      await navigator.clipboard.writeText(url);
      showToast("Link copiado — mandaselo a tu gente 📋");
    } catch {
      showToast("No se pudo generar el link. Probá de nuevo.", true);
    }
  }
  async function handleDelete(){
    if(!deleteTarget)return;
    try{
      await deleteGroup(deleteTarget.id);
      setDeleteTarget(null);
      await onRefresh();
      showToast("Grupo eliminado");
    }catch(err){
      const raw=err as {message?:string};
      showToast(raw?.message||"No se pudo eliminar el grupo.",true);
    }
  }

  return (
    <section className="groups-view">
      <div className="section-title">
        <div>
          <h2>Tus grupos</h2>
          <p>Familia, la barra, capos... cada uno con su link de invitación</p>
        </div>
        <button className="create-desktop" onClick={() => setCreateOpen(true)}>
          <Plus size={19} /> Crear grupo
        </button>
      </div>

      {loading && <p className="groups-status">Cargando tus grupos…</p>}

      {!loading && groups.length === 0 && (
        <div className="empty-state edge">
          <span className="empty-emoji">👥</span>
          <h3>Todavía no tenés grupos</h3>
          <p>Creá uno para tu barra, tu familia o donde sea, y compartí el link para que se sumen con su cuenta.</p>
          <button className="create-submit" onClick={() => setCreateOpen(true)}>
            <Plus size={18} /> Crear mi primer grupo
          </button>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="groups-grid">
          {groups.map((g) => (
            <div className="group-card edge" key={g.id}>
              <div className="group-card-top">
                {g.photo_url?<img className="group-photo" src={g.photo_url} alt=""/>:<span className="group-emoji" style={{ background: g.color }}>{g.emoji}</span>}
                <button className="group-invite" onClick={() => handleInvite(g.id)}>
                  <LinkIcon size={14} /> Invitar
                </button>
                {g.created_by===user?.id&&<button className="group-delete" onClick={()=>setDeleteTarget(g)} aria-label={`Eliminar ${g.name}`}><Trash2/></button>}
              </div>
              <h3>{g.name}</h3>
              {g.description&&<p className="group-description">{g.description}</p>}
              <div className="group-members">
                {g.members.slice(0, 6).map((m) => (
                  <Avatar key={m.id} initials={initialsOf(m.name)} color={m.avatar_color} src={m.avatar_url} small />
                ))}
                <span className="group-count">
                  <Users size={12} /> {g.members.length} {g.members.length === 1 ? "persona" : "personas"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setCreateOpen(true)} aria-label="Crear grupo">
        <Plus />
      </button>

      <AnimatePresence>
        {createOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => e.target === e.currentTarget && setCreateOpen(false)}
          >
            <motion.div
              className="modal edge"
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
            >
              <div className="modal-handle" />
              <div className="modal-head">
                <div>
                  <p className="eyebrow">NUEVO GRUPO</p>
                  <h2>Armá un grupo</h2>
                </div>
                <button onClick={() => setCreateOpen(false)}>
                  <X />
                </button>
              </div>
              <form className="form" onSubmit={handleCreate}>
                <label className="main-input">
                  <span className="emoji-picker">{emoji}</span>
                  <input
                    autoFocus
                    placeholder="Familia, La barra, Capos..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="field"><span>Descripción</span><input value={description} onChange={e=>setDescription(e.target.value)} placeholder="¿Quiénes forman este grupo?"/></label>
                <label className="field"><span>Foto del grupo (opcional)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setPhoto(e.target.files?.[0])}/></label>
                <div className="color-select">
                  <span>Emoji</span>
                  <div>
                    {EMOJIS.map((e) => (
                      <button
                        type="button"
                        key={e}
                        className={e === emoji ? "selected emoji-opt" : "emoji-opt"}
                        onClick={() => setEmoji(e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="color-select">
                  <span>Color del grupo</span>
                  <div>
                    {COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        className={c === color ? "selected" : ""}
                        style={{ background: c }}
                        onClick={() => setColor(c)}
                      >
                        {c === color && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="create-submit" disabled={saving || !name.trim()}>
                  {saving ? "Creando…" : "Crear grupo"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{deleteTarget&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>e.target===e.currentTarget&&setDeleteTarget(null)}><motion.div className="delete-group-modal edge" initial={{scale:.96,y:15}} animate={{scale:1,y:0}} exit={{scale:.97,y:10}}><span><Trash2/></span><h2>¿Eliminar {deleteTarget.name}?</h2><p>Se eliminarán el grupo, sus invitaciones y la relación entre sus integrantes. Esta acción no se puede deshacer.</p><div><button onClick={()=>setDeleteTarget(null)}>Cancelar</button><button className="danger" onClick={handleDelete}>Eliminar grupo</button></div></motion.div></motion.div>}</AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div className={`toast ${toastError?"toast-error":""}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <span>{toastError?<X/>:<Check />}</span>
            <div>
              <b>{toast}</b>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
