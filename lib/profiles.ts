import { supabase } from "./supabase";

export type FullProfile = {
  id: string;
  name: string;
  username: string;
  avatar_color: string;
  avatar_url: string | null;
  bio: string | null;
};

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export async function fetchMyProfile() {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error("No hay sesión activa");
  const { data, error } = await db.from("profiles").select("*").eq("id", auth.user.id).single();
  if (error) throw error;
  return data as FullProfile;
}

export async function usernameAvailable(username: string) {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  const { count, error } = await db.from("profiles").select("id", { count: "exact", head: true })
    .ilike("username", username).neq("id", auth.user?.id || "");
  if (error) throw error;
  return count === 0;
}

export async function updateMyProfile(input: { name: string; username: string; bio?: string; avatarFile?: File }) {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error("No hay sesión activa");
  let avatar_url: string | undefined;
  if (input.avatarFile) {
    const ext = input.avatarFile.name.split(".").pop() || "jpg";
    const path = `${auth.user.id}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await db.storage.from("avatars").upload(path, input.avatarFile, { upsert: true });
    if (uploadError) throw uploadError;
    avatar_url = db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }
  const { data, error } = await db.from("profiles").update({
    name: input.name, username: input.username.toLowerCase(), bio: input.bio || null,
    ...(avatar_url ? { avatar_url } : {}),
  }).eq("id", auth.user.id).select().single();
  if (error) throw error;
  return data as FullProfile;
}

export async function fetchMyStats() {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { groups: 0, friends: 0 };
  const [groupsResult, friendsResult] = await Promise.all([
    db.from("group_members").select("group_id", { count: "exact", head: true }).eq("user_id", auth.user.id),
    db.from("friendships").select("requester_id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${auth.user.id},addressee_id.eq.${auth.user.id}`),
  ]);
  if (groupsResult.error) throw groupsResult.error;
  if (friendsResult.error) throw friendsResult.error;
  return { groups: groupsResult.count || 0, friends: friendsResult.count || 0 };
}
