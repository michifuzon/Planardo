import { supabase } from "./supabase";

export type Profile = {
  id: string;
  name: string;
  username?: string;
  avatar_color: string;
  avatar_url?: string | null;
};

export type Group = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description?: string | null;
  photo_url?: string | null;
  created_by: string;
  members: Profile[];
};

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export async function fetchMyGroups(): Promise<Group[]> {
  const db = client();
  let { data: memberships, error } = await db
    .from("group_members")
    .select("group_id, groups(id, name, emoji, color, description, photo_url, created_by)");
  if (error?.code === "42703" || error?.code === "PGRST204") {
    const fallback = await db.from("group_members").select("group_id, groups(id, name, emoji, color, created_by)");
    memberships = fallback.data as typeof memberships;
    error = fallback.error;
  }
  if (error) throw error;

  const groups = (memberships || [])
    .map((m: any) => m.groups)
    .filter(Boolean) as Omit<Group, "members">[];
  if (groups.length === 0) return [];

  const groupIds = groups.map((g) => g.id);
  const { data: allMembers, error: membersError } = await db
    .from("group_members")
    .select("group_id, profiles(id, name, username, avatar_color, avatar_url)")
    .in("group_id", groupIds);
  if (membersError) throw membersError;

  return groups.map((g) => ({
    ...g,
    members: (allMembers || [])
      .filter((m: any) => m.group_id === g.id)
      .map((m: any) => m.profiles)
      .filter(Boolean),
  }));
}

export async function createGroup(name: string, emoji: string, color: string, description?:string, photoFile?:File) {
  const db = client();
  const { data: userData } = await db.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("No hay sesión activa");

  const { data, error } = await db.rpc("create_group", {
    group_name: name,
    group_emoji: emoji,
    group_color: color,
    group_description: description || null,
  });
  if (error) throw error;
  if (!data?.id) throw new Error("Supabase no devolvió el grupo creado.");
  if(photoFile){
    const ext=photoFile.name.split(".").pop()||"jpg";const path=`groups/${data.id}-${Date.now()}.${ext}`;
    const {error:uploadError}=await db.storage.from("plan-media").upload(path,photoFile);if(uploadError)throw uploadError;
    const photo_url=db.storage.from("plan-media").getPublicUrl(path).data.publicUrl;
    const {error:updateError}=await db.from("groups").update({photo_url}).eq("id",data.id);
    if(updateError && updateError.code !== "42703" && updateError.code !== "PGRST204")throw updateError;
  }
  return data;
}

export async function createInvite(groupId: string) {
  const db = client();
  const { data: userData } = await db.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("No hay sesión activa");

  const { data, error } = await db
    .from("group_invites")
    .insert({ group_id: groupId, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as { code: string; group_name: string; group_emoji: string; group_color: string };
}

export async function fetchInvite(code: string) {
  const db = client();
  const { data, error } = await db.from("group_invites").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  return data as { code: string; group_id: string; group_name: string; group_emoji: string; group_color: string } | null;
}

export async function joinGroupWithInvite(code: string) {
  const db = client();
  const { data, error } = await db.rpc("join_group_with_invite", { invite_code: code });
  if (error) throw error;
  return data as string;
}
