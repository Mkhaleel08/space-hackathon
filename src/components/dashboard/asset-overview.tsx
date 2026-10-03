"use client";

import { useState } from "react";
import Link from "next/link";
import type { Asset, Component, MachineEvent, Reading } from "@/lib/types";
import { formatAbsolute, timeAgo } from "./format";
import { headlineReading, LEVEL_DOT, LEVEL_LABEL, LEVEL_PILL, LEVEL_RANK, type Level, worstLevel, worstOf } from "./status";

const readingStyle: Record<Reading["status"], string> = {
  ok: "text-green-800 dark:text-green-300",
  watch: "text-amber-800 dark:text-amber-300",
  alert: "text-red-800 dark:text-red-300",
};

export type AssetGroup = {
  asset: Asset;
  level: Level;
  unknown: number; // parts without readings
  components: { component: Component; level: Level; lastEvent: MachineEvent | null }[];
  lastEvent: MachineEvent | null;
};

/** Worst asset first; inside an asset, worst part first. */
export function groupAssets(
  assets: Asset[],
  components: Component[],
  readings: Record<string, Reading[]>,
  events: MachineEvent[],
): AssetGroup[] {
  const lastByComponent = new Map<string, MachineEvent>();
  for (const e of events) if (!lastByComponent.has(e.component_id)) lastByComponent.set(e.component_id, e);
  return assets
    .map((asset) => {
      const parts = components
        .filter((c) => c.asset_id === asset.id)
        .map((component) => ({ component, level: worstOf(readings[component.id]), lastEvent: lastByComponent.get(component.id) ?? null }))
        .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.component.name.localeCompare(b.component.name));
      const lastEvent = parts.map((p) => p.lastEvent).filter((e): e is MachineEvent => Boolean(e))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
      return { asset, level: worstLevel(parts.map((p) => p.level)), unknown: parts.filter((p) => p.level === "none").length, components: parts, lastEvent };
    })
    .filter((g) => g.components.length > 0)
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.asset.name.localeCompare(b.asset.name));
}

export default function AssetOverview({ groups, readings, nextSteps, events, now }: {
  groups: AssetGroup[];
  readings: Record<string, Reading[]>;
  nextSteps: Record<string, string>;
  events: MachineEvent[];
  now: number | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <article key={group.asset.id} aria-labelledby={`asset-${group.asset.id}`} className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <header className="flex flex-col gap-1 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 id={`asset-${group.asset.id}`} className="text-lg font-semibold tracking-tight">{group.asset.name}</h3>
              <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${LEVEL_PILL[group.level]}`}>
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                {LEVEL_LABEL[group.level]}
              </span>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {group.asset.model} · {group.asset.hours.toLocaleString("en-US")} h · {group.components.length} {group.components.length === 1 ? "part" : "parts"}
              {group.unknown > 0 && group.level !== "none" ? ` · ${group.unknown} without readings` : ""}
              {group.lastEvent ? <> · last activity <time dateTime={group.lastEvent.created_at} title={formatAbsolute(group.lastEvent.created_at)} suppressHydrationWarning>{timeAgo(group.lastEvent.created_at, now)}</time></> : " · no activity on record"}
            </p>
          </header>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {group.components.map((part) => (
              <ComponentRow key={part.component.id} component={part.component} level={part.level} readings={readings[part.component.id] ?? []} nextStep={nextSteps[part.component.id]} events={events.filter((e) => e.component_id === part.component.id).slice(0, 3)} lastEvent={part.lastEvent} now={now} />
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function ComponentRow({ component, level, readings, nextStep, events, lastEvent, now }: {
  component: Component;
  level: Level;
  readings: Reading[];
  nextStep: string | undefined;
  events: MachineEvent[];
  lastEvent: MachineEvent | null;
  now: number | null;
}) {
  const [open, setOpen] = useState(false);
  const head = headlineReading(readings);
  const detailId = `part-${component.id}-detail`;
  return (
    <li>
      <button type="button" aria-expanded={open} aria-controls={detailId} onClick={() => setOpen((v) => !v)} className="flex min-h-14 w-full cursor-pointer items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 dark:hover:bg-neutral-900">
        <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${LEVEL_DOT[level]}`} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{component.name}</span>
            <span className="text-sm text-neutral-600 dark:text-neutral-300">{component.location}</span>
          </span>
          <span className="mt-0.5 block text-sm text-neutral-600 dark:text-neutral-300">
            <span className="sr-only">{LEVEL_LABEL[level]}. </span>
            {head ? <><span className={level === "ok" ? "" : `font-medium ${readingStyle[head.status]}`}>{head.label} {head.value}</span>{level === "ok" ? "" : `, ${LEVEL_LABEL[level].toLowerCase()}`}</> : <span className="italic">No readings for this part</span>}
            {lastEvent ? <> · {lastEvent.type} <time dateTime={lastEvent.created_at} title={formatAbsolute(lastEvent.created_at)} suppressHydrationWarning>{timeAgo(lastEvent.created_at, now)}</time></> : ""}
          </span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`mt-1 h-5 w-5 shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l5 5 5-5" /></svg>
      </button>
      {open && (
        <div id={detailId} className="flex flex-col gap-4 px-4 pb-4 pl-9.5 text-sm">
          <div className="border-l-2 border-amber-400 pl-3 dark:border-amber-500">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">Next step</p>
            <p className="mt-1 font-medium leading-snug">{nextStep ?? "No recommendation yet. Open the card to generate one."}</p>
          </div>
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">Readings</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-300">{readings.length ? "Simulated feed, no timestamp" : ""}</p>
            </div>
            {readings.length ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {readings.map((r, i) => (
                  <div key={`${r.label}-${i}`} className="min-w-0">
                    <dt className="text-neutral-600 dark:text-neutral-300">{r.label}</dt>
                    <dd className={`font-mono font-semibold ${readingStyle[r.status]}`}>{r.value}<span className="ml-1.5 text-xs font-sans font-bold uppercase">{r.status}</span></dd>
                  </div>
                ))}
              </dl>
            ) : <p className="mt-1 text-neutral-600 dark:text-neutral-300">This part has no telemetry. Status comes from notes only.</p>}
          </div>
          <div>
            <p className="font-semibold">Recent history</p>
            {events.length ? (
              <ol className="mt-2 flex flex-col gap-2">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">{e.type} · {e.author_role} · <time dateTime={e.created_at} suppressHydrationWarning>{formatAbsolute(e.created_at)}</time></span>
                    <span>{e.summary}</span>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-1 text-neutral-600 dark:text-neutral-300">No events recorded for this part yet.</p>}
          </div>
          <Link href={`/components/${component.id}`} className="inline-flex min-h-11 w-fit items-center rounded-full border border-neutral-300 px-4 font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-700 dark:hover:bg-neutral-800">
            Open full card →
          </Link>
        </div>
      )}
    </li>
  );
}
