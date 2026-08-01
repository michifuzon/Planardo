"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, MessageCircle, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchProfileById, type FullProfile } from "@/lib/profiles";
import Avatar from "./Avatar";
import FriendCalendar from "./FriendCalendar";
import DirectChat from "./DirectChat";

const initials = (name: string) => name.slice(0, 2).toUpperCase();

export default function PersonProfileModal({ id, onClose, isFriend, initialTab = "profile" }: { id: string | null; onClose: () => void; isFriend?: boolean; initialTab?: "profile" | "calendar" | "chat" }) {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"profile" | "calendar" | "chat">("profile");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setProfile(null);
    setTab(initialTab);
    fetchProfileById(id).then(setProfile).catch(() => setProfile(null)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <AnimatePresence>
      {id && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div className="person-profile-modal edge" initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.97 }} transition={{ type: "spring", damping: 26, stiffness: 300 }}>
            {loading || !profile ? (
              <div className="person-profile-loading"><div className="auth-loading-mark" /></div>
            ) : (
              <>
                <div className="person-profile-banner" style={{ background: `linear-gradient(155deg, ${profile.avatar_color}, transparent)` }}>
                  <button className="person-profile-close" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
                </div>
                <div className="person-profile-body">
                  <Avatar initials={initials(profile.name)} color={profile.avatar_color} src={profile.avatar_url} />
                  <h2>{profile.name}</h2>
                  <p className="person-profile-username">@{profile.username}</p>

                  {isFriend && (
                    <div className="detail-tabs person-profile-tabs">
                      <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><UserRound size={15} /><span>Perfil</span></button>
                      <button className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}><CalendarDays size={15} /><span>Calendario</span></button>
                      <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}><MessageCircle size={15} /><span>Chat</span></button>
                    </div>
                  )}

                  {tab === "profile" && (profile.bio ? <p className="person-profile-bio">{profile.bio}</p> : <p className="person-profile-bio muted">Todavía no agregó una bio.</p>)}
                  {tab === "calendar" && isFriend && <FriendCalendar friendId={profile.id} />}
                  {tab === "chat" && isFriend && <DirectChat otherId={profile.id} />}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
