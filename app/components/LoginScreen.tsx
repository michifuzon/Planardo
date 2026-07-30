"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Mail, RotateCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !supabase) return;
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <main className="auth-shell">
      <div className="auth-blob blob-a" />
      <div className="auth-blob blob-b" />
      <div className="auth-blob blob-c" />
      <div className="auth-grain" />

      <div className="auth-card">
        <div className="auth-mark">
          <span className="orbit-dot dot-1" />
          <span className="orbit-dot dot-2" />
          <span className="orbit-dot dot-3" />
          <span className="orbit-core" />
        </div>

        <AnimatePresence mode="wait">
          {status !== "sent" ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <p className="auth-eyebrow">PLANARDO</p>
              <h1>
                Juntarse arranca <span>acá</span> <Sparkles size={26} className="auth-sparkle" />
              </h1>
              <p className="auth-copy">
                Metè tu mail y te mandamos un link mágico. Sin contraseñas, sin vueltas.
              </p>

              <form onSubmit={sendLink} className="auth-form">
                <label className={`auth-input ${status === "error" ? "auth-input-error" : ""}`}>
                  <Mail size={18} />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="vos@mail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <button className="auth-submit" disabled={status === "sending"}>
                  {status === "sending" ? (
                    <RotateCw size={18} className="auth-spin" />
                  ) : (
                    <>
                      Enviarme el link <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
              {status === "error" && (
                <p className="auth-error">No pudimos enviar el mail. Probá de nuevo en un rato.</p>
              )}
              <p className="auth-fine">Al continuar aceptás juntarte más seguido con tu gente.</p>
            </motion.div>
          ) : (
            <motion.div
              key="sent"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="auth-sent"
            >
              <div className="auth-sent-icon">
                <Mail size={22} />
              </div>
              <h1>Revisá tu mail ✉️</h1>
              <p className="auth-copy">
                Te mandamos un link a <b>{email}</b>. Abrilo desde este dispositivo para entrar.
              </p>
              <button className="auth-resend" onClick={() => setStatus("idle")}>
                Usar otro mail
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
