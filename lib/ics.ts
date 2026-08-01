function toICSDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICS(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function downloadPlanICS(plan: {
  id: string; name: string; emoji: string; starts_at: string; ends_at?: string | null;
  place_name?: string | null; description?: string | null;
}) {
  const start = toICSDate(plan.starts_at);
  const end = toICSDate(plan.ends_at || new Date(new Date(plan.starts_at).getTime() + 2 * 60 * 60 * 1000).toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Planardo//ES",
    "BEGIN:VEVENT",
    `UID:${plan.id}@planardo.vercel.app`,
    `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(`${plan.emoji} ${plan.name}`)}`,
    plan.place_name ? `LOCATION:${escapeICS(plan.place_name)}` : "",
    plan.description ? `DESCRIPTION:${escapeICS(plan.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${plan.name.replace(/[^\w\s-]/g, "").trim() || "planardo"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
