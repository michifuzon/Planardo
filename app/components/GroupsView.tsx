"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Crown, Link as LinkIcon, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createGroup, createInvite, deleteGroup, fetchMyGroupInviteRequests, inviteFriendToGroup, respondGroupInviteRequest, updateGroup, type Group, type Profile } from "@/lib/groups";
import Avatar from "./Avatar";
import AvailabilityView from "./AvailabilityView";
import GroupChat from "./GroupChat";
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
  initialOpenGroupId,
  plans,
  onSelectPlan,
  onOpenProfile,
  friends = [],
}: {
  groups: Group[];
  loading: boolean;
  onRefresh: () => void;
  initialOpenGroupId?: string | null;
  plans?: any[];
  onSelectPlan?: (id: string) => void;
  onOpenProfile?: (id: string) => void;
  friends?: Profile[];
}) {
  const { user } = useAuth();
  const [openGroupId, setOpenGroupId] = useState<string | null>(initialOpenGroupId ?? null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [description,setDescription]=useState("");
  const [photo,setPhoto]=useState<File>();
  const [invitePicked, setInvitePicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const creatingRef = useRef(false);
  const [toast, setToast] = useState("");
  const [toastError,setToastError]=useState(false);
  const [inviteRequests, setInviteRequests] = useState<any[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const refreshInviteRequests = () => fetchMyGroupInviteRequests().then(setInviteRequests).catch(() => setInviteRequests([]));
  useEffect(() => { refreshInviteRequests(); }, []);

  async function respondInvite(requestId: string, accept: boolean) {
    setRespondingId(requestId);
    try {
      await respondGroupInviteRequest(requestId, accept);
      setInviteRequests(list => list.filter(r => r.id !== requestId));
      if (accept) { onRefresh(); showToast("¡Te sumaste al grupo! 🎉"); }
    } catch {
      showToast("No se pudo responder la invitación.", true);
    } finally {
      setRespondingId(null);
    }
  }

  function showToast(msg: string, error = false) {
    setToast(msg);
    setToastError(error);
    window.setTimeout(() => setToast(""), 2800);
  }

  function resetForm() {
    setCreateOpen(false);
    setEditingId(null);
    setName("");
    setEmoji(EMOJIS[0]);
    setColor(COLORS[0]);
    setDescription("");
    setPhoto(undefined);
    setInvitePicked([]);
  }

  function openEdit(g: Group) {
    setEditingId(g.id);
    setName(g.name);
    setEmoji(g.emoji);
    setColor(g.color);
    setDescription(g.description || "");
    setPhoto(undefined);
    setCreateOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creatingRef.current) return;
    creatingRef.current = true;
    setSaving(true);
    try {
      if (editingId) {
        await updateGroup(editingId, { name: name.trim(), emoji, color, description: description.trim(), photoFile: photo });
        showToast("Grupo actualizado ✏️");
      } else {
        const newGroup = await createGroup(name.trim(), emoji, color, description.trim(), photo);
        if (invitePicked.length) {
          await Promise.all(invitePicked.map(friendId => inviteFriendToGroup(newGroup.id, friendId).catch(() => {})));
        }
        showToast(invitePicked.length ? "Grupo creado — les mandamos la invitación 🎉" : "Grupo creado 🎉");
      }
      resetForm();
      onRefresh();
    } catch (err) {
      const raw = err as { message?: string; details?: string; hint?: string };
      const msg = err instanceof Error ? err.message : raw?.message || raw?.details || raw?.hint || "Error desconocido";
      console.error("saveGroup failed:", err);
      showToast(`No se pudo guardar el grupo. ${msg}`, true);
    } finally {
      creatingRef.current = false;
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

  async function handleDelete() {
    if (!confirmDeleteId || deleting) return;
    setDeleting(true);
    try {
      await deleteGroup(confirmDeleteId);
      setConfirmDeleteId(null);
      setOpenGroupId(null);
      onRefresh();
      showToast("Grupo eliminado");
    } catch (err) {
      const raw = err as { message?: string };
      showToast(`No se pudo eliminar. ${err instanceof Error ? err.message : raw?.message || ""}`, true);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (openGroupId) window.scrollTo({ top: 0 });
  }, [openGroupId]);

  const openGroup = groups.find((g) => g.id === openGroupId) || null;

  return (
    <section className="groups-view" key={openGroup ? `detail-${openGroup.id}` : "list"}>
      {openGroup ? (
        <>
          <button className="detail-back" onClick={() => setOpenGroupId(null)}>
            <ArrowLeft size={17} /> Tus grupos
          </button>
          <div className="group-detail-head edge">
            {openGroup.photo_url ? (
              <img className="group-photo" src={openGroup.photo_url} alt="" />
            ) : (
              <span className="group-emoji" style={{ background: openGroup.color }}>{openGroup.emoji}</span>
            )}
            <div>
              <h1>{openGroup.name}</h1>
              {openGroup.description && <p>{openGroup.description}</p>}
            </div>
            <button className="pulse-secondary" onClick={() => handleInvite(openGroup.id)}>
              <LinkIcon size={15} /> Invitar
            </button>
            {openGroup.created_by === user?.id && (
              <>
                <button className="group-delete" onClick={() => openEdit(openGroup)} aria-label="Editar grupo">
                  <Pencil size={15} />
                </button>
                <button className="group-delete" onClick={() => setConfirmDeleteId(openGroup.id)} aria-label="Eliminar grupo">
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>

          <div className="section-title compact">
            <div><h2>Integrantes</h2><p>{openGroup.members.length} {openGroup.members.length === 1 ? "persona" : "personas"}</p></div>
          </div>
          <div className="group-member-list">
            {openGroup.members.map((m) => (
              <div className="person-card edge" key={m.id} onClick={() => onOpenProfile?.(m.id)} role={onOpenProfile ? "button" : undefined} style={onOpenProfile ? { cursor: "pointer" } : undefined}>
                <Avatar initials={initialsOf(m.name)} color={m.avatar_color} src={m.avatar_url} />
                <span><b>{m.name}</b>{m.id === openGroup.created_by && <small className="owner-tag"><Crown size={11} /> Creador/a</small>}</span>
              </div>
            ))}
          </div>

          <div className="section-title compact">
            <div><h2>Chat del grupo</h2><p>Para coordinar sin depender de un plan puntual</p></div>
          </div>
          <GroupChat groupId={openGroup.id} />

          <div className="section-title compact">
            <div><h2>Agenda del grupo</h2><p>Disponibilidad compartida para armar el próximo plan</p></div>
          </div>
          <AvailabilityView groups={[openGroup]} plans={plans} onSelectPlan={onSelectPlan} />

          {confirmDeleteId && (
            <div className="confirm-remove edge">
              <div><b>¿Eliminar {openGroup.name}?</b><p>Se borra para todos los integrantes junto con sus planes e invitaciones. No se puede deshacer.</p></div>
              <button onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
              <button className="danger" onClick={handleDelete} disabled={deleting}>{deleting ? "Eliminando…" : "Eliminar"}</button>
            </div>
          )}
        </>
      ) : (
        <>
          {inviteRequests.length > 0 && (
            <>
              <div className="section-title compact">
                <div><h2>Invitaciones</h2><p>{inviteRequests.length} esperando tu respuesta</p></div>
              </div>
              <div className="people-list">
                {inviteRequests.map((r: any) => (
                  <div className="person-card edge" key={r.id}>
                    <span className="group-emoji" style={{ background: r.groups?.color, width: 40, height: 40, fontSize: 18 }}>{r.groups?.emoji}</span>
                    <span><b>{r.groups?.name}</b><small>Invitó {r.inviter?.name}</small></span>
                    <div>
                      <button className="accept" onClick={() => respondInvite(r.id, true)} disabled={respondingId === r.id}><Check /></button>
                      <button onClick={() => respondInvite(r.id, false)} disabled={respondingId === r.id}><X /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="section-title">
            <div>
              <h2>Tus grupos</h2>
              <p>Cada grupo tiene su propio link de invitación</p>
            </div>
            <button className="group-create-btn" onClick={() => setCreateOpen(true)}>
              <Plus size={19} /> Crear grupo
            </button>
          </div>

          {loading && <p className="groups-status">Cargando tus grupos…</p>}

          {!loading && groups.length === 0 && (
            <div className="empty-state edge">
              <span className="empty-emoji">👥</span>
              <h3>Todavía no tenés grupos</h3>
              <p>Creá un grupo y compartí el link para que se sumen con su cuenta.</p>
              <button className="create-submit" onClick={() => setCreateOpen(true)}>
                <Plus size={18} /> Crear mi primer grupo
              </button>
            </div>
          )}

          {!loading && groups.length > 0 && (
            <div className="groups-grid">
              {groups.map((g) => (
                <div className="group-card edge" key={g.id} onClick={() => setOpenGroupId(g.id)} role="button" tabIndex={0}>
                  <div className="group-card-top">
                    {g.photo_url?<img className="group-photo" src={g.photo_url} alt=""/>:<span className="group-emoji" style={{ background: g.color }}>{g.emoji}</span>}
                    <button className="group-invite" onClick={(e) => { e.stopPropagation(); handleInvite(g.id); }}>
                      <LinkIcon size={14} /> Invitar
                    </button>
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
        </>
      )}

      <AnimatePresence>
        {createOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => e.target === e.currentTarget && resetForm()}
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
                  <p className="eyebrow">{editingId ? "EDITAR GRUPO" : "NUEVO GRUPO"}</p>
                  <h2>{editingId ? "Editá tu grupo" : "Armá un grupo"}</h2>
                </div>
                <button onClick={resetForm}>
                  <X />
                </button>
              </div>
              <form className="form" onSubmit={handleCreate}>
                <label className="main-input">
                  <span className="emoji-picker">{emoji}</span>
                  <input
                    autoFocus
                    placeholder="Nombre del grupo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="field"><span>Descripción</span><input value={description} onChange={e=>setDescription(e.target.value)} placeholder="¿Quiénes forman este grupo?"/></label>
                <label className="field"><span>{editingId ? "Cambiar foto (opcional)" : "Foto del grupo (opcional)"}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setPhoto(e.target.files?.[0])}/></label>
                {!editingId && friends.length > 0 && (
                  <label className="field">
                    <span>Invitar amigos (opcional)</span>
                    <div className="invitee-picker">
                      {friends.map(f => {
                        const on = invitePicked.includes(f.id);
                        return <button type="button" key={f.id} className={`invitee-chip ${on ? "on" : ""}`} onClick={() => setInvitePicked(list => on ? list.filter(id => id !== f.id) : [...list, f.id])}>
                          <Avatar initials={initialsOf(f.name)} color={f.avatar_color} src={f.avatar_url} small /><span>{f.name}</span>{on && <Check size={13} />}
                        </button>;
                      })}
                    </div>
                  </label>
                )}
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
                  {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear grupo"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
