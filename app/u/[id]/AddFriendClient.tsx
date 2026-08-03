"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Moon, Sun, UserPlus } from "lucide-react";
import { useAuth } from "@/app/components/AuthProvider";
import { fetchProfileById, type FullProfile } from "@/lib/profiles";
import { fetchFriendships, sendFriendRequest } from "@/lib/friends";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import Avatar from "@/app/components/Avatar";

type State = "loading" | "self" | "friends" | "pending" | "ready" | "sending" | "sent" | "invalid" | "error";

const initials = (name: string) => name.slice(0, 2).toUpperCase();

export default function AddFriendClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [state, setState] = useState<State>("loading");
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [light, setLight] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    setLight(stored === "light");
    applyTheme(stored);
  }, []);

  function toggleTheme() {
    const next = light ? "dark" : "light";
    setLight(!light);
    applyTheme(next);
  }

  useEffect(() => {
    let cancelled = false;
    if (user && params.id === user.id) {
      setState("self");
      return;
    }
    Promise.all([fetchProfileById(params.id), fetchFriendships()])
      .then(([p, friendships]) => {
        if (cancelled) return;
        setProfile(p);
        const rel = friendships.find((f) => f.person.id === params.id);
        if (rel?.status === "accepted") setState("friends");
        else if (rel?.status === "pending") setState("pending");
        else setState("ready");
      })
      .catch(() => !cancelled && setState("invalid"));
    return () => {
      cancelled = true;
    };
  }, [params.id, user?.id]);

  async function add() {
    setState("sending");
    try {
      await sendFriendRequest(params.id);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-blob blob-a" />
      <div className="auth-blob blob-b" />
      <div className="auth-blob blob-c" />
      <div className="auth-grain" />
      <button className="icon-button auth-theme-toggle" onClick={toggleTheme} aria-label="Cambiar tema">{light ? <Moon size={19}/> : <Sun size={19}/>}</button>

      <div className="auth-card edge share-profile-card">
        {state === "loading" && (
          <>
            <div className="auth-loading-mark" style={{ margin: "0 auto 20px" }} />
            <p className="auth-copy">Buscando el perfil…</p>
          </>
        )}

        {state === "invalid" && (
          <>
            <h1>Perfil no encontrado</h1>
            <p className="auth-copy">Este link no es válido.</p>
          </>
        )}

        {state === "error" && (
          <>
            <h1>Algo salió mal</h1>
            <p className="auth-copy">No pudimos enviar la solicitud. Probá de nuevo en un rato.</p>
          </>
        )}

        {state === "self" && (
          <>
            <h1>¡Ese sos vos! 👋</h1>
            <p className="auth-copy">Compartí este link con quien querés que te agregue como amigo.</p>
          </>
        )}

        {profile && ["ready", "sending", "sent", "friends", "pending"].includes(state) && (
          <>
            <Avatar initials={initials(profile.name)} color={profile.avatar_color} src={profile.avatar_url} />
            <p className="auth-eyebrow">TE INVITÓ A SER SU AMIGO/A</p>
            <h1>{profile.name}</h1>
            <p className="auth-copy">@{profile.username}</p>

            {state === "friends" && <p className="auth-copy">Ya son amigos en Planardo.</p>}
            {state === "pending" && <p className="auth-copy">Ya hay una solicitud de amistad pendiente entre ustedes.</p>}

            {(state === "ready" || state === "sending") && (
              <button className="auth-submit join-cta" onClick={add} disabled={state === "sending"}>
                {state === "sending" ? "Enviando…" : (<><UserPlus size={17} /> Agregar como amigo</>)}
              </button>
            )}

            {state === "sent" && (
              <p className="auth-copy"><Check size={14} /> Solicitud enviada. Cuando {profile.name} la acepte, van a ser amigos.</p>
            )}

            {(state === "sent" || state === "friends" || state === "pending") && (
              <button className="auth-submit join-cta" onClick={() => router.push("/")}>Ir a Planardo</button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
