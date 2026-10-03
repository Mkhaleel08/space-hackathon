"use client";

import { useState } from "react";
import s from "../workspace.module.css";
import Link from "next/link";
import type { Asset, Component, MachineEvent, Reading } from "@/lib/types";
import { ArrowRight, ChevronDown } from "../icons";
import StatusMark from "../status-mark";
import { btnGhost, btnSmall, meta } from "../ui";
import { formatAbsolute, timeAgo } from "./format";
import {
  headlineReading,
  LEVEL_LABEL,
  LEVEL_RANK,
  LEVEL_TONE,
  type Level,
  worstLevel,
  worstOf,
} from "./status";

export type AssetGroup = {
  asset: Asset;
  level: Level;
  unknown: number; // parts without readings
  components: {
    component: Component;
    level: Level;
    lastEvent: MachineEvent | null;
  }[];
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
  for (const e of events)
    if (!lastByComponent.has(e.component_id))
      lastByComponent.set(e.component_id, e);
  return assets
    .map((asset) => {
      const parts = components
        .filter((c) => c.asset_id === asset.id)
        .map((component) => ({
          component,
          level: worstOf(readings[component.id]),
          lastEvent: lastByComponent.get(component.id) ?? null,
        }))
        .sort(
          (a, b) =>
            LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
            a.component.name.localeCompare(b.component.name),
        );
      const lastEvent =
        parts
          .map((p) => p.lastEvent)
          .filter((e): e is MachineEvent => Boolean(e))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
      return {
        asset,
        level: worstLevel(parts.map((p) => p.level)),
        unknown: parts.filter((p) => p.level === "none").length,
        components: parts,
        lastEvent,
      };
    })
    .filter((g) => g.components.length > 0)
    .sort(
      (a, b) =>
        LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
        a.asset.name.localeCompare(b.asset.name),
    );
}

export default function AssetOverview({
  groups,
  readings,
  nextSteps,
  events,
  now,
}: {
  groups: AssetGroup[];
  readings: Record<string, Reading[]>;
  nextSteps: Record<string, string>;
  events: MachineEvent[];
  now: number | null;
}) {
  return (
    <div>
      {groups.map((group) => (
        <article
          key={group.asset.id}
          aria-labelledby={`asset-${group.asset.id}`}
          className={s.assetGroup}
        >
          <header
            className={s.assetHeader}
            style={{
              borderLeftColor:
                group.level === "none"
                  ? "var(--line)"
                  : `var(--${group.level})`,
            }}
          >
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h3 id={`asset-${group.asset.id}`} className="font-semibold">
                {group.asset.name}
              </h3>
              <StatusMark level={group.level} className="text-xs" />
            </div>
            <p className={meta}>
              {group.asset.model} ·{" "}
              <span className="tabular-nums">
                {group.asset.hours.toLocaleString("en-US")}
              </span>{" "}
              h · {group.components.length}{" "}
              {group.components.length === 1 ? "part" : "parts"}
              {group.unknown > 0 && group.level !== "none"
                ? ` · ${group.unknown} without readings`
                : ""}
              {group.lastEvent ? (
                <>
                  {" "}
                  · last activity{" "}
                  <time
                    dateTime={group.lastEvent.created_at}
                    title={formatAbsolute(group.lastEvent.created_at)}
                    suppressHydrationWarning
                  >
                    {timeAgo(group.lastEvent.created_at, now)}
                  </time>
                </>
              ) : (
                " · no activity on record"
              )}
            </p>
          </header>
          <ul className="border-t border-line">
            {group.components.map((part) => (
              <ComponentRow
                key={part.component.id}
                component={part.component}
                level={part.level}
                readings={readings[part.component.id] ?? []}
                nextStep={nextSteps[part.component.id]}
                events={events
                  .filter((e) => e.component_id === part.component.id)
                  .slice(0, 3)}
              />
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function ComponentRow({
  component,
  level,
  readings,
  nextStep,
  events,
}: {
  component: Component;
  level: Level;
  readings: Reading[];
  nextStep: string | undefined;
  events: MachineEvent[];
}) {
  const [open, setOpen] = useState(false);
  const head = headlineReading(readings);
  const detailId = `part-${component.id}-detail`;
  return (
    <li className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((v) => !v)}
        className={s.partRow}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${LEVEL_TONE[level]} ${level === "none" ? "border border-current" : "bg-current"}`}
        />
        <span className="min-w-0 flex-1">
          <span className={s.partName}>{component.name}</span>
          <span className={s.partLocation}>{component.location}</span>
          <span className="sr-only">{LEVEL_LABEL[level]}.</span>
        </span>
        <span className={s.partReading}>
          {head ? (
            <>
              <strong className={LEVEL_TONE[head.status]}>{head.value}</strong>
              <span>{head.label}</span>
            </>
          ) : (
            <>
              <strong className="text-muted">—</strong>
              <span>No readings</span>
            </>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id={detailId} className="flex flex-col gap-6 pb-5 pl-5 text-sm">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold">
              <span aria-hidden="true" className="h-2 w-2 bg-accent" />
              Next step
            </p>
            <p className="mt-1.5 max-w-[48ch] text-base font-medium leading-snug">
              {nextStep ??
                "No recommendation yet. Open the card to generate one."}
            </p>
          </div>
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">Readings</p>
              {readings.length > 0 && (
                <p className="text-xs text-muted">Simulated feed</p>
              )}
            </div>
            {readings.length ? (
              <dl className="mt-2 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3">
                {readings.map((r, i) => (
                  <div
                    key={`${r.label}-${i}`}
                    className="min-w-0 bg-background px-3 py-2.5"
                  >
                    <dt className="text-muted">{r.label}</dt>
                    <dd
                      className={`mt-1 flex flex-wrap items-baseline gap-x-2 ${LEVEL_TONE[r.status]}`}
                    >
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {r.value}
                      </span>
                      <span className="text-xs font-semibold capitalize">
                        {r.status}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-1 text-muted">
                This part has no telemetry. Status comes from notes only.
              </p>
            )}
          </div>
          <div>
            <p className="font-semibold">Recent history</p>
            {events.length ? (
              <ol className="mt-1 border-t border-line">
                {events.map((e) => (
                  <li key={e.id} className="border-b border-line py-2.5">
                    <p className="leading-snug">{e.summary}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      <span className="capitalize">{e.type}</span> ·{" "}
                      <span className="capitalize">{e.author_role}</span> ·{" "}
                      <time dateTime={e.created_at} suppressHydrationWarning>
                        {formatAbsolute(e.created_at)}
                      </time>
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-1 text-muted">
                No events recorded for this part yet.
              </p>
            )}
          </div>
          <Link
            href={`/components/${component.id}`}
            className={`${btnGhost} ${btnSmall} w-fit`}
          >
            Open full card <ArrowRight />
          </Link>
        </div>
      )}
    </li>
  );
}
