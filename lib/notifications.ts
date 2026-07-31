import { supabase } from "./supabase";
function client(){if(!supabase)throw new Error("Supabase no está configurado");return supabase}
export async function fetchNotifications(){
  const db=client();
  const {data:auth}=await db.auth.getUser();
  if(!auth.user)return [];
  const {data,error}=await db.from("notifications").select("*").eq("user_id",auth.user.id).order("created_at",{ascending:false}).limit(30);
  if(error)throw error;return data||[];
}
export async function markNotificationsRead(){
  const db=client();const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",auth.user?.id).is("read_at",null);
  if(error)throw error;
}
