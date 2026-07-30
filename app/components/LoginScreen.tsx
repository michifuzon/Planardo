"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail, RotateCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";
type Status = "idle" | "loading" | "error" | "confirm-sent";

const errorMessages: Record<string, string> = {
  "Invalid login credentials": "Mail o contraseña incorrectos.",
  "Email not confirmed": "Todavía no confirmaste tu mail. Revisá tu bandeja de entrada.",
  "User already registered": "Ese mail ya tiene una cuenta. Iniciá sesión.",
  "email rate limit exceeded": "Se mandaron muchos mails en poco tiempo. Esperá unos minutos y probá de nuevo.",
  "over_email_send_rate_limit": "Se mandaron muchos mails en poco tiempo. Esperá unos minutos y probá de nuevo.",
};

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function switchMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setErrorMsg("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || !supabase) return;
    setStatus("loading");
    setErrorMsg("");

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
      });
      if (error) {
        setErrorMsg(errorMessages[error.message] || error.message);
        setStatus("error");
        return;
      }
      if (!data.session) {
        setStatus("confirm-sent");
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setErrorMsg(errorMessages[error.message] || error.message);
      setStatus("error");
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-blob blob-a" />
      <div className="auth-blob blob-b" />
      <div className="auth-blob blob-c" />
      <div className="auth-grain" />

      <div className="auth-card edge">
        <div className="auth-mark">
          <span className="orbit-dot dot-1" />
          <span className="orbit-dot dot-2" />
          <span className="orbit-dot dot-3" />
          <span className="orbit-core" />
        </div>

        <AnimatePresence mode="wait">
          {status !== "confirm-sent" ? (
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <p className="auth-eyebrow">PLANARDO</p>
              <h1>
                {mode === "signin" ? (
                  <>Juntarse arranca <span>acá</span></>
                ) : (
                  <>Sumate al <span>plan</span></>
                )}{" "}
                <Sparkles size={26} className="auth-sparkle" />
              </h1>
              <p className="auth-copy">
                {mode === "signin"
                  ? "Entrá con tu mail y tu contraseña."
                  : "Creá tu cuenta con mail y contraseña. Te mandamos un mail para confirmarla."}
              </p>

              <form onSubmit={submit} className="auth-form">
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
                <label className={`auth-input ${status === "error" ? "auth-input-error" : ""}`}>
                  <Lock size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </label>
                <button className="auth-submit" disabled={status === "loading"}>
                  {status === "loading" ? (
                    <RotateCw size={18} className="auth-spin" />
                  ) : (
                    <>
                      {mode === "signin" ? "Iniciar sesión" : "Crear cuenta"} <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
              {status === "error" && <p className="auth-error">{errorMsg}</p>}

              <p className="auth-fine">
                {mode === "signin" ? (
                  <>¿No tenés cuenta? <button type="button" className="auth-link" onClick={() => switchMode("signup")}>Creá una</button></>
                ) : (
                  <>¿Ya tenés cuenta? <button type="button" className="auth-link" onClick={() => switchMode("signin")}>Iniciá sesión</button></>
                )}
              </p>
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
              <h1>Confirmá tu mail ✉️</h1>
              <p className="auth-copy">
                Te mandamos un link de confirmación a <b>{email}</b>. Una vez confirmado, iniciá sesión con tu mail y contraseña.
              </p>
              <button className="auth-resend" onClick={() => switchMode("signin")}>
                Ir a iniciar sesión
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
