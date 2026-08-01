"use client";

import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchDirectMessages, sendDirectMessage } from "@/lib/messages";
import { useAuth } from "./AuthProvider";

export default function DirectChat({ otherId }: { otherId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => fetchDirectMessages(otherId).then(setMessages).catch(() => setMessages([]));
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [otherId]);

  async function send() {
    if (!composer.trim()) return;
    await sendDirectMessage(otherId, composer.trim());
    setComposer("");
    load();
  }

  if (loading) return <div className="chat-panel edge"><div className="messages"><div className="auth-loading-mark" style={{ margin: "40px auto" }} /></div></div>;

  return (
    <div className="chat-panel edge">
      <div className="messages">
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div className={`message ${mine ? "own" : ""}`} key={m.id}>
              <div>
                <span><small>{new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></span>
                <p>{m.body}</p>
              </div>
            </div>
          );
        })}
        {!messages.length && <p className="detail-empty">Arranquen la conversación.</p>}
      </div>
      <div className="chat-composer">
        <input value={composer} onChange={(e) => setComposer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escribí un mensaje…" />
        <button onClick={send}><Send /></button>
      </div>
    </div>
  );
}
