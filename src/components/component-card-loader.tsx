"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ComponentCard as Card, MachineEvent, Role } from "@/lib/types";
import ComponentCard from "./component-card";
import NoteForm from "./note-form";
import { btnPrimary, h1, textLink } from "./ui";

type Result = { kind: "loading" } | { kind: "ready"; card: Card } | { kind: "missing" } | { kind: "error" };

export default function ComponentCardLoader({ id, role }: { id: string; role: Role }) {
  const [result, setResult] = useState<Result>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  const [savedEventId, setSavedEventId] = useState<string>();
  const savedEvent = useRef<MachineEvent | null>(null);
  // Bumped when a card arrives after a save, so the new wording visibly changes.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!savedEventId) return;
    const heading = document.getElementById("events-heading");
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }, [savedEventId]);

  function refreshCard() {
    setRefreshing(true);
    setRefreshError(false);
    setAttempt(value => value + 1);
  }

  function noteSaved(event: MachineEvent) {
    savedEvent.current = event;
    setSavedEventId(event.id);
    // The POST has confirmed persistence. Show that event while the new
    // summary and recommendation are fetched, even if that GET fails.
    setResult(previous => previous.kind === "ready" ? {
      kind: "ready",
      card: { ...previous.card, recent_events: [event, ...previous.card.recent_events.filter(item => item.id !== event.id)].slice(0, 5) },
    } : previous);
    refreshCard();
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    async function load() {
      try {
        const response = await fetch(`/api/components/${encodeURIComponent(id)}/card?role=${role}`, {
          signal: controller.signal, cache: "no-store",
        });
        if (response.status === 404) {
          if (active) setResult({ kind: "missing" });
          return;
        }
        if (!response.ok) throw new Error("Card request failed");
        const card: Card = await response.json();
        if (active) {
          // Keep the confirmed note visible if a refresh returns stale history.
          const confirmed = savedEvent.current;
          if (confirmed && !card.recent_events.some(event => event.id === confirmed.id)) {
            card.recent_events = [confirmed, ...card.recent_events].slice(0, 5);
          }
          setResult({ kind: "ready", card });
          if (confirmed) setRefreshKey(value => value + 1);
        }
      } catch {
        if (active) {
          setResult(previous => previous.kind === "ready" ? previous : { kind: "error" });
          setRefreshError(true);
        }
      } finally {
        window.clearTimeout(timeout);
        if (active) setRefreshing(false);
      }
    }
    void load();
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [id, role, attempt]);

  if (result.kind === "ready") return (
    <>
      <div className="min-h-6 text-sm text-muted" aria-live="polite">
        {refreshing && <p className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent" />Re-reading the history and next step…</p>}
        {refreshError && <p role="alert" className="text-alert">Couldn’t refresh the card. The details below may be out of date. <button type="button" onClick={refreshCard} className={`${textLink} text-foreground`}>Refresh card</button></p>}
      </div>
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-16">
        <ComponentCard card={result.card} savedEventId={savedEventId} refreshKey={refreshKey} />
        <div className="lg:sticky lg:top-8">
          <NoteForm id={id} role={role} onSaved={noteSaved} onCheckHistory={refreshCard} />
        </div>
      </div>
    </>
  );
  if (result.kind === "loading") return (
    <div role="status" aria-label="Loading this part’s history" className="flex flex-col gap-12">
      <div className="flex flex-col gap-3">
        <Bar className="h-9 w-3/5" />
        <Bar className="h-4 w-2/5" />
        <div className="mt-2 border-t border-line pt-4"><Bar className="h-4 w-1/2" /></div>
      </div>
      <div className="flex flex-col gap-3">
        <Bar className="h-3.5 w-20" />
        <Bar className="h-7 w-full" />
        <Bar className="h-7 w-4/5" />
      </div>
      <div className="flex flex-col gap-3">
        <Bar className="h-4 w-44" />
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-11/12" />
        <Bar className="h-4 w-3/4" />
      </div>
      <p className="sr-only">Loading this part’s history…</p>
    </div>
  );
  if (result.kind === "missing") return (
    <section className="min-h-48 py-6">
      <h1 className={h1}>Unknown part</h1>
      <p className="mt-3 max-w-[50ch] text-muted">This label doesn’t match a part in the machine’s history.</p>
      <Link href="/scan" className={`${btnPrimary} mt-6`}>Scan again</Link>
    </section>
  );
  return (
    <section className="min-h-48 py-6">
      <h1 className={h1}>Couldn’t load this part</h1>
      <p role="alert" className="mt-3 max-w-[50ch] text-muted">Check your connection and try again. The machine’s history may be temporarily unavailable.</p>
      <button type="button" onClick={() => { setResult({ kind: "loading" }); setAttempt(value => value + 1); }} className={`${btnPrimary} mt-6`}>Try again</button>
    </section>
  );
}

function Bar({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-ctl bg-surface ${className}`} />;
}
