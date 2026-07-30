import { supabase } from "./supabase";
import type { FullProfile } from "./profiles";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export async function searchPeople(query: string) {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  const { data, error } = await db.from("profiles").select("*")
    .or(`username.ilike.%${query}%,name.ilike.%${query}%`).neq("id", auth.user?.id || "").limit(12);
  if (error) throw error;
  return data as FullProfile[];
}

export async function fetchFriendships() {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await db.from("friendships")
    .select("requester_id,addressee_id,status,requester:profiles!friendships_requester_id_fkey(*),addressee:profiles!friendships_addressee_id_fkey(*)")
    .or(`requester_id.eq.${auth.user.id},addressee_id.eq.${auth.user.id}`);
  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...row,
    person: row.requester_id === auth.user!.id ? row.addressee : row.requester,
    incoming: row.addressee_id === auth.user!.id,
  }));
}

export async function sendFriendRequest(addresseeId: string) {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error("No hay sesión activa");
  const { error } = await db.from("friendships").insert({ requester_id: auth.user.id, addressee_id: addresseeId });
  if (error) throw error;
}

export async function respondFriendRequest(requesterId: string, accept: boolean) {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error("No hay sesión activa");
  if (accept) {
    const { error } = await db.from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("requester_id", requesterId).eq("addressee_id", auth.user.id);
    if (error) throw error;
  } else {
    const { error } = await db.from("friendships").delete().eq("requester_id", requesterId).eq("addressee_id", auth.user.id);
    if (error) throw error;
  }
}
