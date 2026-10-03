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
      <div role="group" aria-label="View as" className="grid grid-cols-2 gap-1 rounded-full border border-neutral-300 p-1 dark:border-neutral-700">
        {(["operator", "technician"] as const).map(value => (
          <button key={value} type="button" aria-pressed={role === value} onClick={() => selectRole(value)} className={`min-h-12 cursor-pointer rounded-full px-3 py-3 font-medium capitalize focus-visible:outline-2 focus-visible:outline-offset-2 ${role === value ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>
            {value}
          </button>
        ))}
      </div>
      <ComponentCardLoader key={`${id}:${role}`} id={id} role={role} />
    </>
  );
}
