"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Component, DashboardData, MachineEvent } from "@/lib/types";
import ActivityFeed from "./activity-feed";
import AssetOverview, { groupAssets } from "./asset-overview";
import { formatAbsolute, useNow } from "./format";
import { LEVEL_LABEL, type Level, worstOf } from "./status";
import TagManager from "./tag-manager";
import { Close } from "../icons";
import { btnGhost, btnSmall, field, h1, h2, meta, section } from "../ui";

type StatusFilter = "all" | Level;
const STATUS_ORDER: Level[] = ["alert", "watch", "ok", "none"];

const chip = "min-h-10 shrink-0 cursor-pointer whitespace-nowrap rounded-ctl border px-3 text-sm font-medium transition-colors duration-150";
const chipOff = "border-line hover:border-muted hover:bg-surface";
const chipOn = "border-foreground bg-foreground text-background";
const navLink = "inline-flex min-h-11 items-center text-sm font-medium text-muted hover:text-foreground";

export default function Dashboard({ initial }: { initial: DashboardData }) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [assetId, setAssetId] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [notice, setNotice] = useState("");
  const inflight = useRef<AbortController | null>(null);
  const now = useNow();

  async function refresh() {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setRefreshing(true);
    setRefreshError(false);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error("dashboard request failed");
      setData(await res.json());
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setRefreshError(true);
    } finally {
      if (inflight.current === controller) {
        inflight.current = null;
        setRefreshing(false);
      }
    }
  }

  const componentsById = useMemo(() => new Map(data.components.map((c) => [c.id, c])), [data.components]);
  const assetsById = useMemo(() => new Map(data.assets.map((a) => [a.id, a])), [data.assets]);

  const q = query.trim().toLowerCase();
  const inAsset = (componentId: string) => assetId === "all" || componentsById.get(componentId)?.asset_id === assetId;
  const scoped = data.components.filter((c) => inAsset(c.id) && (!q || [c.name, c.location, c.id].some((s) => s.toLowerCase().includes(q))));
  const counts = Object.fromEntries(STATUS_ORDER.map((l) => [l, scoped.filter((c) => worstOf(data.readings[c.id]) === l).length])) as Record<Level, number>;
  const visibleComponents = scoped.filter((c) => status === "all" || worstOf(data.readings[c.id]) === status);
  const groups = groupAssets(data.assets, visibleComponents, data.readings, data.events);
  const visibleEvents = data.events.filter((e) => {
    if (!inAsset(e.component_id)) return false;
    if (!q) return true;
    const component = componentsById.get(e.component_id);
    return [e.summary, e.detail ?? "", component?.name ?? "", component?.location ?? ""].some((s) => s.toLowerCase().includes(q));
  });
  const filtered = q !== "" || status !== "all" || assetId !== "all";

  function eventDeleted(event: MachineEvent, component: Component | undefined) {
    setData((prev) => ({ ...prev, events: prev.events.filter((e) => e.id !== event.id) }));
    setNotice(`Deleted “${event.summary}” from ${component?.name ?? event.component_id}. Re-reading the memory…`);
    void refresh().then(() => setNotice((n) => (n.startsWith("Deleted") ? n.replace(" Re-reading the memory…", " Summary and next step updated.") : n)));
  }

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setAssetId("all");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-5 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-col gap-8">
        <nav aria-label="Machine Memory" className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex min-h-11 items-center font-semibold tracking-tight hover:text-muted">Machine Memory</Link>
          <div className="flex gap-6">
            <Link href="/ar" className={navLink}>Live view</Link>
            <Link href="/scan" className={navLink}>Scan</Link>
          </div>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className={h1}>Operator dashboard</h1>
            <p className={`${meta} mt-1.5`}>
              {data.assets.length} {data.assets.length === 1 ? "asset" : "assets"} · {data.components.length} parts · {data.events.length} events on record
            </p>
          </div>
          <div className="flex items-center gap-4">
            <p role="status" className={meta}>
              {refreshing ? "Refreshing…" : refreshError ? <span className="text-alert">Couldn’t refresh. Showing the last good data.</span> : <>Updated <time dateTime={data.generated_at} suppressHydrationWarning>{formatAbsolute(data.generated_at)}</time></>}
            </p>
            <button type="button" onClick={refresh} disabled={refreshing} aria-busy={refreshing} className={`${btnGhost} ${btnSmall} disabled:cursor-wait`}>Refresh</button>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">Search parts, locations and notes</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parts, locations, notes" className={field} />
            </label>
            <label className="sm:w-64">
              <span className="sr-only">Asset</span>
              <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={`${field} appearance-none`}>
                <option value="all">All assets</option>
                {data.assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          </div>
          <div role="group" aria-label="Filter parts by status" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            <button type="button" aria-pressed={status === "all"} onClick={() => setStatus("all")} className={`${chip} ${status === "all" ? chipOn : chipOff}`}>All parts <span className="tabular-nums opacity-60">{scoped.length}</span></button>
            {STATUS_ORDER.map((l) => (
              <button key={l} type="button" aria-pressed={status === l} onClick={() => setStatus(status === l ? "all" : l)} className={`${chip} ${status === l ? chipOn : chipOff}`}>
                {LEVEL_LABEL[l]} <span className="tabular-nums opacity-60">{counts[l]}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-x-16">
        <section aria-labelledby="assets-heading" className={`${section} flex min-w-0 flex-col gap-6`}>
          <h2 id="assets-heading" className={h2}>Assets</h2>
          {groups.length ? (
            <AssetOverview groups={groups} readings={data.readings} nextSteps={data.next_steps} events={data.events} now={now} />
          ) : (
            <div className="flex flex-col items-start gap-4 border-y border-line py-10">
              <p className="text-muted">{data.components.length ? "No parts match these filters." : "No parts on record yet. Run the seed to load the demo machines."}</p>
              {filtered && <button type="button" onClick={clearFilters} className={`${btnGhost} ${btnSmall}`}>Clear filters</button>}
            </div>
          )}
        </section>
        <section aria-labelledby="activity-heading" className={`${section} flex min-w-0 flex-col gap-6`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="activity-heading" className={`${h2} shrink-0`}>Recent activity</h2>
            <p className={meta}>Notes, faults, repairs, inspections</p>
          </div>
          {notice && (
            <div role="status" className="flex items-start justify-between gap-3 border border-line bg-surface px-4 py-3 text-sm">
              <p className="flex items-start gap-2.5"><span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 bg-accent" />{notice}</p>
              <button type="button" onClick={() => setNotice("")} aria-label="Dismiss" className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-ctl text-muted hover:text-foreground"><Close /></button>
            </div>
          )}
          <ActivityFeed events={visibleEvents} componentsById={componentsById} assetsById={assetsById} now={now} emptyMessage={data.events.length ? "No activity matches these filters." : "Nothing recorded yet. Notes from the field show up here."} onDeleted={eventDeleted} />
        </section>
      </div>

      <TagManager assets={data.assets} components={data.components} tags={data.tags} tagsLive={data.tags_live} onChanged={refresh} />
    </main>
  );
}
