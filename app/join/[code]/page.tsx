import type { Metadata } from "next";
import JoinClient from "./JoinClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function fetchInviteInfo(code: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/group_invites?code=eq.${encodeURIComponent(code)}&select=group_name,group_emoji`,
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
  const title = invite ? `Te invito al grupo ${invite.group_name}` : "Te invitaron a un grupo en Planardo";
  const description = invite
    ? `Sumate a ${invite.group_name} en Planardo para coordinar el próximo plan.`
    : "Entrá para sumarte al grupo en Planardo.";
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: "/og-image.png", width: 1200, height: 1200 }], locale: "es_AR", type: "website" },
    twitter: { card: "summary", title, description, images: ["/og-image.png"] },
  };
}

export default function JoinPage() {
  return <JoinClient />;
}
