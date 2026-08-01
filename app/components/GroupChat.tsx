"use client";

import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchGroupMessages, sendGroupMessage } from "@/lib/messages";
import { useAuth } from "./AuthProvider";
import Avatar from "./Avatar";

const initials = (name: string) => name.slice(0, 2).toUpperCase();

export default function GroupChat({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => fetchGroupMessages(groupId).then(setMessages).catch(() => setMessages([]));
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [groupId]);

  async function send() {
    if (!composer.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await sendGroupMessage(groupId, composer.trim());
      setComposer("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="chat-panel edge"><div className="messages"><div className="auth-loading-mark" style={{ margin: "40px auto" }} /></div></div>;

  return (
    <div className="chat-panel edge">
      <div className="messages">
        {messages.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div className={`message ${mine ? "own" : ""}`} key={m.id}>
              {!mine && <Avatar initials={initials(m.profiles.name)} color={m.profiles.avatar_color} src={m.profiles.avatar_url} small />}
              <div>
                <span>{!mine && <b>{m.profiles.name}</b>}<small>{new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></span>
                <p>{m.body}</p>
              </div>
            </div>
          );
        })}
        {!messages.length && <p className="detail-empty">El chat del grupo arranca con el primer mensaje.</p>}
      </div>
      {error && <p className="quick-error">{error}</p>}
      <div className="chat-composer">
        <input value={composer} onChange={(e) => setComposer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escribí un mensaje al grupo…" />
        <button type="button" onClick={send} disabled={sending}><Send /></button>
      </div>
    </div>
  );
}
