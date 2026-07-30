import { supabase } from "./supabase";

function client(){if(!supabase)throw new Error("Supabase no está configurado");return supabase}
export async function fetchAvailability(from:string,to:string){
  const {data,error}=await client().from("availability").select("day,status,user_id,profiles(name,avatar_color,avatar_url)").gte("day",from).lte("day",to);
  if(error)throw error; return data||[];
}
export async function setAvailability(day:string,status:"available"|"maybe"|"busy"){
  const db=client();const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("availability").upsert({day,status,user_id:auth.user?.id});if(error)throw error;
}
export async function fetchGroupAvailability(groupId:string,from:Date,to:Date){
  const {data,error}=await client().rpc("get_group_availability",{
    target_group:groupId,range_start:from.toISOString(),range_end:to.toISOString(),
  });
  if(error)throw error;return data||[];
}
