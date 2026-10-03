"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { OPERATOR_PIN_HEADER } from "@/lib/operator";
import type { Asset, Component, MachineEvent } from "@/lib/types";
import { formatAbsolute, timeAgo } from "./format";
import { forgetPin, loadPin, savePin } from "./operator-pin";

const PAGE = 25;

const typeStyle: Record<MachineEvent["type"], string> = {
  fault: "text-red-700 dark:text-red-300",
  repair: "text-green-800 dark:text-green-300",
  inspection: "text-neutral-600 dark:text-neutral-300",
  note: "text-amber-800 dark:text-amber-300",
};

export default function ActivityFeed({ events, componentsById, assetsById, now, emptyMessage, onDeleted }: {
  events: MachineEvent[];
  componentsById: Map<string, Component>;
  assetsById: Map<string, Asset>;
  now: number | null;
  emptyMessage: string;
  onDeleted: (event: MachineEvent, component: Component | undefined) => void;
}) {
  const [shown, setShown] = useState(PAGE);
  if (!events.length) return <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">{emptyMessage}</p>;
  const rest = events.length - shown;
  return (
    <div className="flex flex-col gap-3">
      <ol className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {events.slice(0, shown).map((event) => {
          const component = componentsById.get(event.component_id);
          const asset = component ? assetsById.get(component.asset_id) : undefined;
          return <ActivityItem key={event.id} event={event} component={component} asset={asset} now={now} onDeleted={onDeleted} />;
        })}
      </ol>
      {rest > 0 && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="min-h-11 cursor-pointer self-center rounded-full border border-neutral-300 px-5 text-sm font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-700 dark:hover:bg-neutral-800">
          Show {Math.min(PAGE, rest)} more
        </button>
      )}
    </div>
  );
}

function ActivityItem({ event, component, asset, now, onDeleted }: {
  event: MachineEvent;
  component: Component | undefined;
  asset: Asset | undefined;
  now: number | null;
  onDeleted: (event: MachineEvent, component: Component | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const detailId = `event-${event.id}-detail`;
  return (
    <li>
      <button type="button" aria-expanded={open} aria-controls={detailId} onClick={() => setOpen((v) => !v)} className="flex min-h-14 w-full cursor-pointer flex-col gap-1 px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 dark:hover:bg-neutral-900">
        <span className="flex w-full items-baseline justify-between gap-3">
          <span className={`text-xs font-semibold uppercase tracking-wide ${typeStyle[event.type]}`}>{event.type}</span>
          <time dateTime={event.created_at} title={formatAbsolute(event.created_at)} suppressHydrationWarning className="shrink-0 text-xs text-neutral-600 dark:text-neutral-300">{timeAgo(event.created_at, now)}</time>
        </span>
        <span className="font-medium leading-snug">{event.summary}</span>
        <span className="text-sm text-neutral-600 dark:text-neutral-300">
          {component?.name ?? event.component_id}{asset ? ` · ${asset.name}` : ""} · {event.author_role}
        </span>
      </button>
      {open && (
        <div id={detailId} className="flex flex-col gap-3 px-4 pb-4 text-sm">
          {event.detail && event.detail.trim() !== event.summary.trim() ? (
            <blockquote className="whitespace-pre-wrap border-l-2 border-neutral-300 pl-3 leading-relaxed text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">{event.detail}</blockquote>
          ) : <p className="text-neutral-600 dark:text-neutral-300">No detail beyond the summary was recorded.</p>}
          <p className="text-xs text-neutral-600 dark:text-neutral-300">
            Recorded <time dateTime={event.created_at} suppressHydrationWarning>{formatAbsolute(event.created_at)}</time>{component ? ` · ${component.location}` : ""}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {component ? (
              <Link href={`/components/${component.id}`} className="inline-flex min-h-11 w-fit items-center rounded-full border border-neutral-300 px-4 font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-700 dark:hover:bg-neutral-800">
                Open {component.name} →
              </Link>
            ) : <span />}
            <button type="button" onClick={() => setConfirming(true)} className="min-h-11 cursor-pointer rounded-full px-4 font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-red-300 dark:hover:bg-red-950/40">
              Delete this {event.type}…
            </button>
          </div>
        </div>
      )}
      {confirming && (
        <DeleteDialog event={event} component={component} asset={asset} onClose={() => setConfirming(false)} onDeleted={() => { setConfirming(false); onDeleted(event, component); }} />
      )}
    </li>
  );
}

const dialogButton = "min-h-12 cursor-pointer rounded-full px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-wait disabled:opacity-60";

function DeleteDialog({ event, component, asset, onClose, onDeleted }: {
  event: MachineEvent;
  component: Component | undefined;
  asset: Asset | undefined;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pin, setPin] = useState(() => loadPin());
  const [askPin, setAskPin] = useState(() => loadPin() === "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const titleId = `delete-${event.id}-title`;

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const trimmed = pin.trim();
    if (!trimmed) {
      setAskPin(true);
      setError("Enter the operator PIN to delete.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}`, { method: "DELETE", headers: { [OPERATOR_PIN_HEADER]: trimmed } });
      if (res.status === 401) {
        forgetPin();
        setPin("");
        setAskPin(true);
        setError("That PIN didn’t match. Try again.");
        return;
      }
      if (res.status === 503) {
        setError("Deleting is switched off on this deployment: no operator PIN is configured.");
        return;
      }
      if (res.status === 404) {
        // Already gone, perhaps deleted from another device. Treat as done.
        onDeleted();
        return;
      }
      if (!res.ok) throw new Error("delete failed");
      savePin(trimmed);
      onDeleted();
    } catch {
      setError("Couldn’t delete. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }} onClose={onClose} aria-labelledby={titleId} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-neutral-300 bg-white p-6 text-neutral-950 backdrop:bg-black/50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <h2 id={titleId} className="text-xl font-semibold">Delete this {event.type}?</h2>
        <div className="rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">
            {event.type} · {event.author_role} · <time dateTime={event.created_at}>{formatAbsolute(event.created_at)}</time>
          </p>
          <p className="mt-1 font-medium">{event.summary}</p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-300">{component?.name ?? event.component_id}{asset ? ` · ${asset.name}` : ""}</p>
        </div>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          It disappears from this dashboard and from the part’s history, and the part’s summary and next step are rewritten without it. Readings and every other record stay.
        </p>
        {askPin && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Operator PIN
            <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus className="min-h-11 rounded-lg border border-neutral-400 bg-transparent px-3 font-mono text-base focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-600" />
          </label>
        )}
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={`${dialogButton} border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800`}>Keep it</button>
          <button type="submit" disabled={busy} aria-busy={busy} className={`${dialogButton} bg-red-700 text-white hover:bg-red-800 dark:bg-red-500 dark:text-black dark:hover:bg-red-400`}>{busy ? "Deleting…" : "Delete"}</button>
        </div>
      </form>
    </dialog>
  );
}
