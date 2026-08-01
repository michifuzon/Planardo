import { supabase } from "./supabase";

function client(){if(!supabase)throw new Error("Supabase no está configurado");return supabase}

export type AdminUser = {
  id:string; email:string; name:string; username:string; created_at:string;
  group_count:number; friend_count:number; plan_count:number;
};

export async function fetchAdminUsers(){
  const {data,error}=await client().rpc("admin_list_users");
  if(error)throw error;
  return (data||[]) as AdminUser[];
}
