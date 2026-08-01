import type { Metadata } from "next";
import JoinPlanClient from "./JoinPlanClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function fetchInviteInfo(code: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/plan_invites?code=eq.${encodeURIComponent(code)}&select=plan_name,plan_emoji`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const invite = await fetchInviteInfo(code);
  const title = invite ? `Te invito a ${invite.plan_name}` : "Te invitaron a un Planardo";
  const description = invite
    ? `Sumate a ${invite.plan_name} en Planardo.`
    : "Entrá para sumarte a este Planardo.";
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: "/og-image.png", width: 1200, height: 1200 }], locale: "es_AR", type: "website" },
    twitter: { card: "summary", title, description, images: ["/og-image.png"] },
  };
}

export default function JoinPlanPage() {
  return <JoinPlanClient />;
}
