"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchFriendBusy } from "@/lib/friends";
import { cap } from "@/lib/format";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const pad = (n: number) => String(n).padStart(2, "0");

export default function FriendCalendar({ friendId }: { friendId: string }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [ranges, setRanges] = useState<{ busy_from: string; busy_until: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    setLoading(true);
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    fetchFriendBusy(friendId, from, to).then(setRanges).catch(() => setRanges([])).finally(() => setLoading(false));
  }, [friendId, month]);

  const days = useMemo(() => {
    const year = month.getFullYear(), m = month.getMonth();
    const count = new Date(year, m + 1, 0).getDate();
    const offset = (new Date(year, m, 1).getDay() + 6) % 7;
    const cells = Math.ceil((offset + count) / 7) * 7;
    return Array.from({ length: cells }, (_, i) => { const day = i - offset + 1; return day >= 1 && day <= count ? new Date(year, m, day) : null; });
  }, [month]);

  function rangesOn(day: Date) {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    return ranges.filter(r => new Date(r.busy_from) < dayEnd && new Date(r.busy_until) > dayStart);
  }
  function isBusy(day: Date) { return rangesOn(day).length > 0; }
  function busyLabel(day: Date) {
    const rs = rangesOn(day);
    if (!rs.length) return "Libre todo el día";
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const fullDay = rs.some(r => new Date(r.busy_from) <= dayStart && new Date(r.busy_until) >= dayEnd);
    if (fullDay) return "Ocupado todo el día";
    const fmt = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return rs.map(r => {
      const from = new Date(r.busy_from), until = new Date(r.busy_until);
      return `Ocupado ${fmt(from < dayStart ? dayStart : from)}–${fmt(until > dayEnd ? dayEnd : until)}`;
    }).join(" · ");
  }

  return (
    <div className="friend-calendar">
      <div className="calendar-header">
        <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft /></button>
        <h2>{cap(month.toLocaleDateString("es-AR", { month: "long", year: "numeric" }))}</h2>
        <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight /></button>
      </div>
      <div className="weekdays">{WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="calendar-grid">
        {days.map((day, i) => day ? (
          <button type="button" key={i} className={`day ${isBusy(day) ? "day-busy" : ""} ${selectedDay?.getTime() === day.getTime() ? "selected" : ""}`} onClick={() => setSelectedDay(day)}>
            <span className="day-number">{day.getDate()}</span>
          </button>
        ) : <span key={i} />)}
      </div>
      {loading && <p className="detail-empty">Cargando disponibilidad…</p>}
      {!loading && selectedDay && (
        <div className="friend-day-detail">
          <b>{cap(selectedDay.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }))}</b>
          <p>{busyLabel(selectedDay)}</p>
        </div>
      )}
      <p className="availability-note">Solo se comparte ocupado/libre, no el detalle de los planes.</p>
    </div>
  );
}
