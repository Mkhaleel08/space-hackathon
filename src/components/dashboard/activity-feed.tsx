"use client";

import { useState } from "react";
import Link from "next/link";
import type { Asset, Component, MachineEvent } from "@/lib/types";
import { formatAbsolute, timeAgo } from "./format";

const PAGE = 25;

const typeStyle: Record<MachineEvent["type"], string> = {
  fault: "text-red-700 dark:text-red-300",
  repair: "text-green-800 dark:text-green-300",
  inspection: "text-neutral-600 dark:text-neutral-300",
  note: "text-amber-800 dark:text-amber-300",
};

export default function ActivityFeed({ events, componentsById, assetsById, now, emptyMessage }: {
  events: MachineEvent[];
  componentsById: Map<string, Component>;
  assetsById: Map<string, Asset>;
  now: number | null;
  emptyMessage: string;
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
          return <ActivityItem key={event.id} event={event} component={component} asset={asset} now={now} />;
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

function ActivityItem({ event, component, asset, now }: {
  event: MachineEvent;
  component: Component | undefined;
  asset: Asset | undefined;
  now: number | null;
}) {
  const [open, setOpen] = useState(false);
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
          {component && (
            <Link href={`/components/${component.id}`} className="inline-flex min-h-11 w-fit items-center rounded-full border border-neutral-300 px-4 font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-700 dark:hover:bg-neutral-800">
              Open {component.name} →
            </Link>
          )}
        </div>
      )}
    </li>
  );
}
