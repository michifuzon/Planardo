import { supabase } from "./supabase";

function client(){if(!supabase)throw new Error("Supabase no está configurado");return supabase}

export type AvailabilityBlock = {
  id: string;
  day: string;
  status: "available" | "maybe" | "busy";
  time_from: string | null;
  time_to: string | null;
};

export async function fetchAvailability(from:string,to:string): Promise<AvailabilityBlock[]>{
  const db=client();
  const {data:auth}=await db.auth.getUser();
  if(!auth.user)return [];
  const {data,error}=await db.from("availability").select("id,day,status,time_from,time_to").eq("user_id",auth.user.id).gte("day",from).lte("day",to);
  if(error)throw error; return data||[];
}
export async function addAvailabilityBlock(day:string,status:"available"|"maybe"|"busy",timeFrom?:string,timeTo?:string){
  const db=client();const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("availability").insert({
    day,status,user_id:auth.user?.id,time_from:timeFrom||null,time_to:timeTo||null,
  });
  if(error)throw error;
}
export async function removeAvailabilityBlock(id:string){
  const {error}=await client().from("availability").delete().eq("id",id);
  if(error)throw error;
}
export async function fetchGroupAvailability(groupId:string,from:Date,to:Date){
  const {data,error}=await client().rpc("get_group_availability",{
    target_group:groupId,range_start:from.toISOString(),range_end:to.toISOString(),
  });
  if(error)throw error;return data||[];
}
