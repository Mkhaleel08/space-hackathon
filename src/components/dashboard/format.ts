import { useSyncExternalStore } from "react";

// One shared minute ticker for relative times. The server snapshot is null so
// the first client render matches; callers show the absolute date until then.
const listeners = new Set<() => void>();
let timer: number | null = null;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) timer = window.setInterval(() => listeners.forEach((l) => l()), 60_000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;
const serverNow = () => null;

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, minuteNow, serverNow);
}

const sameYear = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const otherYear = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function formatAbsolute(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "Date unavailable";
  const d = new Date(t);
  return d.getFullYear() === new Date().getFullYear() ? sameYear.format(d) : otherYear.format(d);
}

/** "just now", "3 h ago", "6 d ago"; falls back to the absolute date past 30 days. */
export function timeAgo(iso: string, now: number | null): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "Date unavailable";
  if (now === null) return formatAbsolute(iso);
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d <= 30) return `${d} d ago`;
  return formatAbsolute(iso);
}
