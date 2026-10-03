"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DashboardData } from "@/lib/types";
import ActivityFeed from "./activity-feed";
import AssetOverview, { groupAssets } from "./asset-overview";
import { formatAbsolute, useNow } from "./format";
import { LEVEL_LABEL, type Level, worstOf } from "./status";

type StatusFilter = "all" | Level;
const STATUS_ORDER: Level[] = ["alert", "watch", "ok", "none"];

const chip = "min-h-9 cursor-pointer rounded-full border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2";
const chipOff = "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";
const chipOn = "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black";
const field = "min-h-11 rounded-full border border-neutral-300 bg-transparent px-4 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-700";

export default function Dashboard({ initial }: { initial: DashboardData }) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [assetId, setAssetId] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
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

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setAssetId("all");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4">
        <nav aria-label="Machine Memory" className="flex items-center justify-between gap-3 text-sm">
          <Link href="/" className="flex min-h-11 items-center rounded underline underline-offset-4 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4">Machine Memory</Link>
          <div className="flex gap-4">
            <Link href="/ar" className="flex min-h-11 items-center rounded underline underline-offset-4 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4">Live view</Link>
            <Link href="/scan" className="flex min-h-11 items-center rounded underline underline-offset-4 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4">Scan</Link>
          </div>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Operator dashboard</h1>
            <p className="mt-1 text-neutral-600 dark:text-neutral-300">
              {data.assets.length} {data.assets.length === 1 ? "asset" : "assets"} · {data.components.length} parts · {data.events.length} events on record
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p role="status" className="text-sm text-neutral-600 dark:text-neutral-300">
              {refreshing ? "Refreshing…" : refreshError ? "Couldn’t refresh. Showing the last good data." : <>Updated <time dateTime={data.generated_at} suppressHydrationWarning>{formatAbsolute(data.generated_at)}</time></>}
            </p>
            <button type="button" onClick={refresh} disabled={refreshing} aria-busy={refreshing} className={`${chip} ${chipOff} min-h-11 px-4 disabled:cursor-wait disabled:opacity-60`}>Refresh</button>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">Search parts, locations and notes</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parts, locations, notes" className={`${field} w-full`} />
            </label>
            <label className="sm:w-64">
              <span className="sr-only">Asset</span>
              <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={`${field} w-full appearance-none bg-white dark:bg-neutral-950`}>
                <option value="all">All assets</option>
                {data.assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          </div>
          <div role="group" aria-label="Filter parts by status" className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={status === "all"} onClick={() => setStatus("all")} className={`${chip} ${status === "all" ? chipOn : chipOff}`}>All parts <span className="opacity-70">{scoped.length}</span></button>
            {STATUS_ORDER.map((l) => (
              <button key={l} type="button" aria-pressed={status === l} onClick={() => setStatus(status === l ? "all" : l)} className={`${chip} ${status === l ? chipOn : chipOff}`}>
                {LEVEL_LABEL[l]} <span className="opacity-70">{counts[l]}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <section aria-labelledby="assets-heading" className="flex min-w-0 flex-col gap-3">
          <h2 id="assets-heading" className="text-lg font-semibold">Assets</h2>
          {groups.length ? (
            <AssetOverview groups={groups} readings={data.readings} nextSteps={data.next_steps} events={data.events} now={now} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center dark:border-neutral-700">
              <p className="text-neutral-600 dark:text-neutral-300">{data.components.length ? "No parts match these filters." : "No parts on record yet. Run the seed to load the demo machines."}</p>
              {filtered && <button type="button" onClick={clearFilters} className={`${chip} ${chipOff} min-h-11 px-4`}>Clear filters</button>}
            </div>
          )}
        </section>
        <section aria-labelledby="activity-heading" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="activity-heading" className="shrink-0 text-lg font-semibold">Recent activity</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Notes, faults, repairs, inspections</p>
          </div>
          <ActivityFeed events={visibleEvents} componentsById={componentsById} assetsById={assetsById} now={now} emptyMessage={data.events.length ? "No activity matches these filters." : "Nothing recorded yet. Notes from the field show up here."} />
        </section>
      </div>
    </main>
  );
}
