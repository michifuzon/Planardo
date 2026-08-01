import type { Metadata } from "next";
import AddFriendClient from "./AddFriendClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function fetchPublicProfile(id: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_profile`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: id }),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await fetchPublicProfile(id);
  const title = profile ? `Agregame en Planardo: ${profile.name}` : "Te invitaron a Planardo";
  const description = profile
    ? `${profile.name} te invita a ser su amigo/a en Planardo para armar planes juntos.`
    : "Entrá para agregar a esta persona como amigo en Planardo.";
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: "/og-image.png", width: 1200, height: 1200 }], locale: "es_AR", type: "website" },
    twitter: { card: "summary", title, description, images: ["/og-image.png"] },
  };
}

export default function AddFriendPage() {
  return <AddFriendClient />;
}
