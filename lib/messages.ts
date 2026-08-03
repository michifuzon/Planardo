import { supabase } from "./supabase";

function client(){if(!supabase)throw new Error("Supabase no está configurado");return supabase}

export async function fetchGroupMessages(groupId:string){
  const {data,error}=await client().from("group_messages")
    .select("*,profiles:user_id(name,avatar_color,avatar_url)")
    .eq("group_id",groupId).order("created_at");
  if(error)throw error; return data||[];
}
export async function sendGroupMessage(groupId:string,body:string){
  const db=client(); const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("group_messages").insert({group_id:groupId,user_id:auth.user?.id,body});
  if(error)throw error;
}
export async function deleteGroupMessage(id:string){
  const {data,error}=await client().from("group_messages").delete().eq("id",id).select();
  if(error)throw error;
  if(!data||!data.length)throw new Error("No se pudo borrar el mensaje (revisá los permisos).");
}
export async function fetchDirectMessages(otherId:string){
  const db=client(); const {data:auth}=await db.auth.getUser();
  if(!auth.user)return [];
  const {data,error}=await db.from("direct_messages")
    .select("*,profiles:sender_id(name,avatar_color,avatar_url)")
    .or(`and(sender_id.eq.${auth.user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${auth.user.id})`)
    .order("created_at");
  if(error)throw error; return data||[];
}
export async function sendDirectMessage(otherId:string,body:string){
  const db=client(); const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("direct_messages").insert({sender_id:auth.user?.id,recipient_id:otherId,body});
  if(error)throw error;
}
export async function deleteDirectMessage(id:string){
  const {data,error}=await client().from("direct_messages").delete().eq("id",id).select();
  if(error)throw error;
  if(!data||!data.length)throw new Error("No se pudo borrar el mensaje (revisá los permisos).");
}
