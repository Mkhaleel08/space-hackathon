"use client";

import { useSyncExternalStore } from "react";
import type { Role } from "@/lib/types";
import ComponentCardLoader from "./component-card-loader";

const storageKey = "machine-memory:role";
const changeEvent = "machine-memory:role-updated";
let sessionRole: Role = "operator";
function readRole(): Role {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "operator" || stored === "technician") return stored;
  } catch { /* Keep the session choice when storage is unavailable. */ }
  return sessionRole;
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}
const serverRole = (): Role => "operator";

export default function RoleCard({ id }: { id: string }) {
  const role = useSyncExternalStore(subscribe, readRole, serverRole);
  function selectRole(next: Role) {
    if (next === role) return;
    const apply = () => {
      sessionRole = next;
      try { window.localStorage.setItem(storageKey, next); } catch { /* Session fallback. */ }
      window.dispatchEvent(new Event(changeEvent));
    };
    // A note form can block switching until its draft is saved or discarded.
    const request = new CustomEvent("machine-memory:before-role-change", { cancelable: true, detail: { apply } });
    if (window.dispatchEvent(request)) apply();
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span id="view-as-label" className="text-sm text-muted">View as</span>
        <div role="group" aria-labelledby="view-as-label" className="relative grid grid-cols-2 rounded-ctl border border-line p-1">
          <span aria-hidden="true" className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[2px] bg-accent transition-transform duration-200 ease-out-expo ${role === "technician" ? "translate-x-full" : ""}`} />
          {(["operator", "technician"] as const).map(value => (
            <button key={value} type="button" aria-pressed={role === value} onClick={() => selectRole(value)} className={`relative min-h-11 cursor-pointer rounded-[2px] px-5 text-sm font-medium capitalize transition-colors duration-200 ${role === value ? "text-accent-ink" : "text-muted hover:text-foreground"}`}>
              {value}
            </button>
          ))}
        </div>
      </div>
      <ComponentCardLoader key={`${id}:${role}`} id={id} role={role} />
    </>
  );
}
