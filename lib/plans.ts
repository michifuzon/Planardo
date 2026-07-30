import { supabase } from "./supabase";

export type PlanInput = {
  name: string; emoji: string; date: string; time: string; place_name?: string;
  end_date?: string; end_time?: string; description?: string; color: string; group_id?: string;
  invitee_ids?: string[]; plan_type?: string; location_url?: string; notes?: string;
  cover_file?: File;
};

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export async function createPlan(input: PlanInput) {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error("No hay sesión activa");
  const starts_at = new Date(`${input.date}T${input.time}:00`).toISOString();
  const ends_at = input.end_date ? new Date(`${input.end_date}T${input.end_time || input.time}:00`).toISOString() : null;
  const { data, error } = await db.from("plans").insert({
    created_by: auth.user.id, group_id: input.group_id || null, name: input.name,
    emoji: input.emoji, starts_at, ends_at, place_name: input.place_name || null,
    description: input.description || null, color: input.color,
    plan_type: input.plan_type || "other", location_url: input.location_url || null, notes: input.notes || null,
  }).select().single();
  if (error) throw error;
  if(input.cover_file){
    const ext=input.cover_file.name.split(".").pop()||"jpg";
    const path=`${data.id}/cover-${Date.now()}.${ext}`;
    const {error:uploadError}=await db.storage.from("plan-media").upload(path,input.cover_file);
    if(uploadError)throw uploadError;
    const cover_url=db.storage.from("plan-media").getPublicUrl(path).data.publicUrl;
    const {error:updateError}=await db.from("plans").update({cover_url}).eq("id",data.id);
    if(updateError)throw updateError;
  }
  const invitees = [...new Set(input.invitee_ids || [])].filter((id) => id !== auth.user!.id);
  if (invitees.length) {
    const { error: memberError } = await db.from("plan_members").insert(invitees.map((user_id) => ({ plan_id: data.id, user_id })));
    if (memberError) throw memberError;
  }
  return data;
}

export async function fetchMyPlans() {
  const db = client();
  const { data, error } = await db.from("plan_members")
    .select("response, plans(*, plan_members(response,user_id,profiles(id,name,username,avatar_color,avatar_url)))")
    .order("created_at", { referencedTable: "plans", ascending: true });
  if (error) throw error;
  return (data || []).map((row: any) => ({ ...row.plans, my_response: row.response })).filter(Boolean);
}

export async function fetchPlanDetail(id: string) {
  const db = client();
  const [plan, checklist, items, timeline, expenses, transport, polls, messages, photos, comments] = await Promise.all([
    db.from("plans").select("*, group:groups(id,name,emoji), plan_members(response,role,user_id,attended,profiles(id,name,username,avatar_color,avatar_url))").eq("id",id).single(),
    db.from("plan_checklist").select("*,profiles:completed_by(name)").eq("plan_id",id).order("position"),
    db.from("plan_items").select("*,profiles:claimed_by(name,avatar_color,avatar_url)").eq("plan_id",id).order("created_at"),
    db.from("plan_timeline").select("*").eq("plan_id",id).order("starts_at"),
    db.from("plan_expenses").select("*,profiles:paid_by(name),plan_payments(*)").eq("plan_id",id),
    db.from("plan_transport").select("*,profiles:user_id(name,avatar_color,avatar_url)").eq("plan_id",id),
    db.from("polls").select("*,poll_options(*,poll_votes(*))").eq("plan_id",id).order("created_at"),
    db.from("plan_messages").select("*,profiles:user_id(name,avatar_color,avatar_url),message_reactions(*)").eq("plan_id",id).order("created_at"),
    db.from("plan_photos").select("*,profiles:uploaded_by(name,avatar_url)").eq("plan_id",id).order("created_at",{ascending:false}),
    db.from("plan_comments").select("*,profiles:user_id(name,avatar_color,avatar_url)").eq("plan_id",id).order("created_at"),
  ]);
  if (plan.error) throw plan.error;
  return {
    ...plan.data, checklist: checklist.data||[], items:items.data||[], timeline:timeline.data||[],
    expenses:expenses.data||[], transport:transport.data||[], polls:polls.data||[], messages:messages.data||[],
    photos:photos.data||[], comments:comments.data||[],
  };
}

export async function respondToPlan(planId:string,response:"going"|"maybe"|"declined"){
  const {data,error}=await client().rpc("respond_to_plan",{target_plan:planId,desired_response:response});
  if(error)throw error;
  return data as {status:"updated"|"conflict";conflicts?:Array<{id:string;name:string;emoji:string;starts_at:string;ends_at:string|null}>};
}
export async function addChecklistItem(planId:string,label:string){
  const {error}=await client().from("plan_checklist").insert({plan_id:planId,label}); if(error)throw error;
}
export async function toggleChecklistItem(id:string,completed:boolean){
  const db=client(); const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("plan_checklist").update({completed,completed_by:completed?auth.user?.id:null}).eq("id",id); if(error)throw error;
}
export async function addPlanItem(planId:string,label:string){
  const db=client(); const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("plan_items").insert({plan_id:planId,label,created_by:auth.user?.id}); if(error)throw error;
}
export async function claimPlanItem(id:string,claim:boolean){
  const db=client(); const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("plan_items").update({claimed_by:claim?auth.user?.id:null}).eq("id",id); if(error)throw error;
}
export async function addTimelineItem(planId:string,title:string,startsAt:string){
  const {error}=await client().from("plan_timeline").insert({plan_id:planId,title,starts_at:new Date(startsAt).toISOString()}); if(error)throw error;
}
export async function addExpense(planId:string,label:string,amount:number){
  const db=client(); const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("plan_expenses").insert({plan_id:planId,label,amount,paid_by:auth.user?.id}); if(error)throw error;
}
export async function addPoll(planId:string,question:string,options:string[]){
  const db=client(); const {data:auth}=await db.auth.getUser();
  const {data,error}=await db.from("polls").insert({plan_id:planId,question,created_by:auth.user?.id}).select().single();
  if(error)throw error;
  const {error:optionError}=await db.from("poll_options").insert(options.filter(Boolean).map((label,position)=>({poll_id:data.id,label,position})));
  if(optionError)throw optionError;
}
export async function votePoll(optionId:string){
  const db=client(); const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("poll_votes").upsert({option_id:optionId,user_id:auth.user?.id}); if(error)throw error;
}
export async function sendPlanMessage(planId:string,body:string){
  const db=client(); const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("plan_messages").insert({plan_id:planId,user_id:auth.user?.id,body}); if(error)throw error;
}
export async function setPlanTransport(planId:string,mode:string,seats:number){
  const db=client();const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("plan_transport").upsert({plan_id:planId,user_id:auth.user?.id,mode,seats_available:seats});if(error)throw error;
}
export async function uploadPlanPhoto(planId:string,file:File){
  const db=client();const {data:auth}=await db.auth.getUser();if(!auth.user)throw new Error("No hay sesión");
  const ext=file.name.split(".").pop()||"jpg";const path=`${planId}/${auth.user.id}-${Date.now()}.${ext}`;
  const {error:uploadError}=await db.storage.from("plan-media").upload(path,file);if(uploadError)throw uploadError;
  const url=db.storage.from("plan-media").getPublicUrl(path).data.publicUrl;
  const {error}=await db.from("plan_photos").insert({plan_id:planId,uploaded_by:auth.user.id,url});if(error)throw error;
}
export async function addPlanComment(planId:string,body:string){
  const db=client();const {data:auth}=await db.auth.getUser();
  const {error}=await db.from("plan_comments").insert({plan_id:planId,user_id:auth.user?.id,body});if(error)throw error;
}
