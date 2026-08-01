"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchProfileById, type FullProfile } from "@/lib/profiles";
import Avatar from "./Avatar";

const initials = (name: string) => name.slice(0, 2).toUpperCase();

export default function PersonProfileModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setProfile(null);
    fetchProfileById(id).then(setProfile).catch(() => setProfile(null)).finally(() => setLoading(false));
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
                  {profile.bio ? <p className="person-profile-bio">{profile.bio}</p> : <p className="person-profile-bio muted">Todavía no agregó una bio.</p>}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
