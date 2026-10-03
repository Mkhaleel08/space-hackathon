"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { OPERATOR_PIN_HEADER } from "@/lib/operator";
import type { Asset, Component, MachineEvent } from "@/lib/types";
import { ChevronDown } from "../icons";
import Reveal from "../reveal";
import { btnDanger, btnGhost, btnSmall, field, fieldLabel } from "../ui";
import { formatAbsolute, timeAgo } from "./format";
import { forgetPin, loadPin, savePin } from "./operator-pin";

const PAGE = 25;

const typeTone: Record<MachineEvent["type"], string> = {
  fault: "text-alert",
  repair: "text-ok",
  inspection: "text-muted",
  note: "text-foreground",
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
  if (!events.length) return <p className="border-y border-line py-10 text-center text-muted">{emptyMessage}</p>;
  const rest = events.length - shown;
  return (
    <div className="flex flex-col gap-4">
      <ol className="border-t border-line">
        {events.slice(0, shown).map((event) => {
          const component = componentsById.get(event.component_id);
          const asset = component ? assetsById.get(component.asset_id) : undefined;
          return <ActivityItem key={event.id} event={event} component={component} asset={asset} now={now} onDeleted={onDeleted} />;
        })}
      </ol>
      {rest > 0 && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className={`${btnGhost} ${btnSmall} self-start`}>
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
    <li className="border-b border-line">
      <button type="button" aria-expanded={open} aria-controls={detailId} onClick={() => setOpen((v) => !v)} className="flex min-h-14 w-full cursor-pointer items-start gap-3 py-3.5 text-left hover:bg-surface sm:-mx-3 sm:w-[calc(100%+1.5rem)] sm:px-3">
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug">{event.summary}</span>
          <span className="mt-1 flex flex-wrap justify-between gap-x-4 text-sm text-muted">
            <span><span className={`font-medium capitalize ${typeTone[event.type]}`}>{event.type}</span>, {component?.name ?? event.component_id}{asset ? ` on ${asset.name}` : ""}</span>
            <time dateTime={event.created_at} title={formatAbsolute(event.created_at)} suppressHydrationWarning>{timeAgo(event.created_at, now)}</time>
          </span>
        </span>
        <ChevronDown className={`mt-1.5 h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <Reveal open={open} id={detailId}>
        <div className="flex flex-col gap-4 pb-5 text-sm">
          {event.detail && event.detail.trim() !== event.summary.trim() ? (
            <p className="max-w-[65ch] whitespace-pre-wrap leading-relaxed text-muted">{event.detail}</p>
          ) : <p className="text-muted">No detail beyond the summary was recorded.</p>}
          <p className="text-xs text-muted">
            Recorded <time dateTime={event.created_at} suppressHydrationWarning>{formatAbsolute(event.created_at)}</time> by the {event.author_role}{component ? `. ${component.location}.` : "."}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {component ? (
              <Link href={`/components/${component.id}`} className={`${btnGhost} ${btnSmall}`}>
                Open {component.name}
              </Link>
            ) : <span />}
            <button type="button" onClick={() => setConfirming(true)} className={`${btnGhost} ${btnSmall} text-alert hover:border-alert`}>
              Delete this {event.type}…
            </button>
          </div>
        </div>
      </Reveal>
      {confirming && (
        <DeleteDialog event={event} component={component} asset={asset} onClose={() => setConfirming(false)} onDeleted={() => { setConfirming(false); onDeleted(event, component); }} />
      )}
    </li>
  );
}

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
    <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }} onClose={onClose} aria-labelledby={titleId} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-ctl border border-line bg-background p-6 text-foreground backdrop:bg-black/60">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <h2 id={titleId} className="text-xl font-semibold tracking-tight">Delete this {event.type}?</h2>
        <div className="border-y border-line py-3 text-sm">
          <p className="font-medium leading-snug">{event.summary}</p>
          <p className="mt-1 text-muted">
            <span className="capitalize">{event.type}</span> by the {event.author_role}, <time dateTime={event.created_at}>{formatAbsolute(event.created_at)}</time>
          </p>
          <p className="mt-0.5 text-muted">{component?.name ?? event.component_id}{asset ? ` on ${asset.name}` : ""}</p>
        </div>
        <p className="text-sm text-muted">
          It disappears from this dashboard and from the part’s history, and the part’s summary and next step are rewritten without it. Readings and every other record stay.
        </p>
        {askPin && (
          <label className={fieldLabel}>
            Operator PIN
            <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus className={`${field} font-mono`} />
          </label>
        )}
        {error && <p role="alert" className="text-sm text-alert">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={btnGhost}>Keep it</button>
          <button type="submit" disabled={busy} aria-busy={busy} className={`${btnDanger} disabled:cursor-wait`}>{busy ? "Deleting…" : "Delete"}</button>
        </div>
      </form>
    </dialog>
  );
}
