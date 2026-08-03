"use client";

import { useParams, useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchPlanInvite, joinPlanWithInvite, type PlanInvite } from "@/lib/plans";
import { fetchMyGroups } from "@/lib/groups";
import { applyTheme, getStoredTheme } from "@/lib/theme";

type State = "loading" | "ready" | "joining" | "joined" | "invalid" | "error";

export default function JoinPlanClient() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [invite, setInvite] = useState<PlanInvite | null>(null);
  const [inMyGroup, setInMyGroup] = useState(false);
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
    fetchPlanInvite(params.code)
      .then(async (data) => {
        if (cancelled) return;
        if (!data) {
          setState("invalid");
          return;
        }
        setInvite(data);
        if (data.plan_group_id) {
          try {
            const groups = await fetchMyGroups();
            if (!cancelled) setInMyGroup(groups.some((g) => g.id === data.plan_group_id));
          } catch {}
        }
        if (!cancelled) setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [params.code]);

  async function join() {
    setState("joining");
    try {
      await joinPlanWithInvite(params.code);
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
      <button className="icon-button auth-theme-toggle" onClick={toggleTheme} aria-label="Cambiar tema">{light ? <Moon size={19}/> : <Sun size={19}/>}</button>

      <div className="auth-card edge">
        {state === "loading" && (
          <>
            <div className="auth-loading-mark" style={{ margin: "0 auto 20px" }} />
            <p className="auth-copy">Buscando el Planardo…</p>
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
            <div className="auth-sent-icon" style={{ background: invite.plan_color + "26", color: invite.plan_color, fontSize: 24 }}>
              {invite.plan_emoji}
            </div>
            <p className="auth-eyebrow">TE INVITARON A</p>
            <h1>{invite.plan_name}</h1>
            <p className="auth-copy">
              {inMyGroup
                ? "Es un plan de uno de tus grupos. Sumate para ver los detalles y coordinar."
                : "Te invitaron como invitado a este Planardo puntual."}
            </p>
            <button className="auth-submit join-cta" onClick={join} disabled={state === "joining"}>
              {state === "joining" ? "Uniéndote…" : "Unirme al Planardo"}
            </button>
          </>
        )}

        {state === "joined" && invite && (
          <>
            <h1>¡Listo! 🎉</h1>
            <p className="auth-copy">
              Ya sos parte de <b>{invite.plan_name}</b>. Te llevamos al inicio…
            </p>
          </>
        )}
      </div>
    </main>
  );
}
