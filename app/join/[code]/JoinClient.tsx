"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchInvite, joinGroupWithInvite } from "@/lib/groups";

type State = "loading" | "ready" | "joining" | "joined" | "invalid" | "error";

export default function JoinClient() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [invite, setInvite] = useState<{ group_name: string; group_emoji: string; group_color: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInvite(params.code)
      .then((data) => {
        if (cancelled) return;
        if (!data) setState("invalid");
        else {
          setInvite(data);
          setState("ready");
        }
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [params.code]);

  async function join() {
    setState("joining");
    try {
      await joinGroupWithInvite(params.code);
      setState("joined");
      window.setTimeout(() => router.push("/"), 1400);
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

      <div className="auth-card edge">
        {state === "loading" && (
          <>
            <div className="auth-loading-mark" style={{ margin: "0 auto 20px" }} />
            <p className="auth-copy">Buscando la invitación…</p>
          </>
        )}

        {state === "invalid" && (
          <>
            <h1>Invitación inválida</h1>
            <p className="auth-copy">Este link no existe o ya venció. Pedile a quien te invitó que te mande uno nuevo.</p>
          </>
        )}

        {state === "error" && (
          <>
            <h1>Algo salió mal</h1>
            <p className="auth-copy">No pudimos procesar la invitación. Probá de nuevo en un rato.</p>
          </>
        )}

        {(state === "ready" || state === "joining") && invite && (
          <>
            <div className="auth-sent-icon" style={{ background: invite.group_color + "26", color: invite.group_color, fontSize: 24 }}>
              {invite.group_emoji}
            </div>
            <p className="auth-eyebrow">TE INVITARON A</p>
            <h1>{invite.group_name}</h1>
            <p className="auth-copy">Sumate para ver los planes y coordinar con el grupo.</p>
            <button className="auth-submit" onClick={join} disabled={state === "joining"}>
              {state === "joining" ? "Uniéndote…" : "Unirme al grupo"}
            </button>
          </>
        )}

        {state === "joined" && invite && (
          <>
            <h1>¡Listo! 🎉</h1>
            <p className="auth-copy">
              Ya sos parte de <b>{invite.group_name}</b>. Te llevamos al inicio…
            </p>
          </>
        )}
      </div>
    </main>
  );
}
