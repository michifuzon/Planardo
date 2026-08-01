"use client";

import { useEffect, useState } from "react";
import { fetchAdminUsers, type AdminUser } from "@/lib/admin";

export default function AdminView() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetchAdminUsers().then(setUsers).catch((e) => setError(e?.message || "No se pudo cargar.")).finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) =>
    !q.trim() || u.name?.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase()) || u.username?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <section className="admin-view">
      <div className="greeting"><div><p className="eyebrow">SOLO ADMIN</p><h1>Panel de administración</h1><p>Todas las personas activas en Planardo.</p></div></div>

      {loading ? (
        <div className="detail-loading"><div className="auth-loading-mark" /></div>
      ) : error ? (
        <div className="empty-state edge"><h3>No se pudo cargar</h3><p>{error}</p></div>
      ) : (
        <>
          <div className="admin-stats">
            <div><b>{users.length}</b><span>Usuarios</span></div>
            <div><b>{users.reduce((s, u) => s + u.group_count, 0)}</b><span>Membresías de grupo</span></div>
            <div><b>{Math.round(users.reduce((s, u) => s + u.friend_count, 0) / 2)}</b><span>Amistades</span></div>
            <div><b>{users.reduce((s, u) => s + u.plan_count, 0)}</b><span>Invitaciones a planes</span></div>
          </div>

          <input className="admin-search" placeholder="Buscar por nombre, usuario o mail…" value={q} onChange={(e) => setQ(e.target.value)} />

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Persona</th><th>Mail</th><th>Grupos</th><th>Amigos</th><th>Planes</th><th>Alta</th></tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td><b>{u.name}</b><small>@{u.username}</small></td>
                    <td>{u.email}</td>
                    <td>{u.group_count}</td>
                    <td>{u.friend_count}</td>
                    <td>{u.plan_count}</td>
                    <td>{new Date(u.created_at).toLocaleDateString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
