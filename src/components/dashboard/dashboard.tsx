"use client";

import { useMemo, useRef, useState } from "react";
import type { Component, DashboardData, MachineEvent } from "@/lib/types";
import ActivityFeed from "./activity-feed";
import AssetOverview, { groupAssets } from "./asset-overview";
import { formatAbsolute, useNow } from "./format";
import { LEVEL_LABEL, type Level, worstOf } from "./status";
import TagManager from "./tag-manager";
import { ArrowRight, Close, Refresh, Search } from "../icons";
import SiteHeader from "../site-header";
import s from "../workspace.module.css";
import { btnGhost, btnSmall, field } from "../ui";

type StatusFilter = "all" | Level;
const STATUS_ORDER: Level[] = ["alert", "watch", "ok", "none"];

const CONDITION_HINT: Record<Level, string> = {
  alert: "Review these parts first",
  watch: "Keep an eye on these parts",
  ok: "Readings within range",
  none: "Condition not yet measured",
};
const CONDITION_COLOR: Record<Level, string> = {
  alert: "var(--alert)",
  watch: "var(--watch)",
  ok: "var(--ok)",
  none: "var(--muted)",
};

export default function Dashboard({ initial }: { initial: DashboardData }) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState<"overview" | "activity" | "tags">(
    "overview",
  );
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
      const res = await fetch("/api/dashboard", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("dashboard request failed");
      setData(await res.json());
      return true;
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError"))
        setRefreshError(true);
      return false;
    } finally {
      if (inflight.current === controller) {
        inflight.current = null;
        setRefreshing(false);
      }
    }
  }

  const componentsById = useMemo(
    () => new Map(data.components.map((c) => [c.id, c])),
    [data.components],
  );
  const assetsById = useMemo(
    () => new Map(data.assets.map((a) => [a.id, a])),
    [data.assets],
  );

  const q = query.trim().toLowerCase();
  const inAsset = (componentId: string) =>
    assetId === "all" || componentsById.get(componentId)?.asset_id === assetId;
  const matchingNoteParts = new Set(
    q
      ? data.events
          .filter((e) =>
            [e.summary, e.detail ?? ""].some((text) =>
              text.toLowerCase().includes(q),
            ),
          )
          .map((e) => e.component_id)
      : [],
  );
  const scoped = data.components.filter(
    (c) =>
      inAsset(c.id) &&
      (!q ||
        matchingNoteParts.has(c.id) ||
        [c.name, c.location, c.id].some((s) => s.toLowerCase().includes(q))),
  );
  const counts = Object.fromEntries(
    STATUS_ORDER.map((l) => [
      l,
      scoped.filter((c) => worstOf(data.readings[c.id]) === l).length,
    ]),
  ) as Record<Level, number>;
  const visibleComponents = scoped.filter(
    (c) => status === "all" || worstOf(data.readings[c.id]) === status,
  );
  const groups = groupAssets(
    data.assets,
    visibleComponents,
    data.readings,
    data.events,
  );
  const visibleEvents = data.events.filter((e) => {
    if (!inAsset(e.component_id)) return false;
    if (!q) return true;
    const component = componentsById.get(e.component_id);
    return [
      e.summary,
      e.detail ?? "",
      component?.name ?? "",
      component?.location ?? "",
    ].some((s) => s.toLowerCase().includes(q));
  });
  const filtered = q !== "" || status !== "all" || assetId !== "all";

  function eventDeleted(event: MachineEvent, component: Component | undefined) {
    setData((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== event.id),
    }));
    setNotice(
      `Deleted “${event.summary}” from ${component?.name ?? event.component_id}. Re-reading the memory…`,
    );
    void refresh().then((ok) =>
      setNotice((n) =>
        n.startsWith("Deleted")
          ? n.replace(
              " Re-reading the memory…",
              ok
                ? " Summary and next step updated."
                : " Refresh to load the latest summary and next step.",
            )
          : n,
      ),
    );
  }

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setAssetId("all");
  }

  return (
    <>
      <SiteHeader active="dashboard" />
      <main id="main-content" className={s.workspace}>
        <header className={s.pageHeading}>
          <div>
            <p className={s.eyebrow}>Operator workspace</p>
            <h1>Operation overview</h1>
            <p>
              {data.assets.length}{" "}
              {data.assets.length === 1 ? "asset" : "assets"} ·{" "}
              {data.components.length} parts · {data.events.length} events on
              record
            </p>
          </div>
          <div className={s.refreshGroup}>
            <p role="status">
              {refreshing ? (
                "Refreshing…"
              ) : refreshError ? (
                <span className="text-alert">
                  Couldn’t refresh. Showing the last good data.
                </span>
              ) : (
                <>
                  Updated{" "}
                  <time dateTime={data.generated_at} suppressHydrationWarning>
                    {formatAbsolute(data.generated_at)}
                  </time>
                </>
              )}
            </p>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              aria-busy={refreshing}
              className={`${btnGhost} ${btnSmall}`}
            >
              <Refresh
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </header>
        <nav aria-label="Dashboard sections" className={s.dashboardNav}>
          <button
            type="button"
            aria-pressed={view === "overview"}
            onClick={() => setView("overview")}
          >
            Overview <span>{data.assets.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={view === "activity"}
            onClick={() => setView("activity")}
          >
            Activity <span>{data.events.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={view === "tags"}
            onClick={() => setView("tags")}
          >
            AprilTags <span>{data.tags.length}</span>
          </button>
        </nav>
        {view === "overview" && (
          <div
            role="group"
            aria-label="Filter parts by status"
            className={s.conditionGrid}
          >
            {STATUS_ORDER.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={status === l}
                onClick={() => setStatus(status === l ? "all" : l)}
                className={s.condition}
              >
                <span className={s.conditionLabel}>
                  <i aria-hidden="true" style={{ color: CONDITION_COLOR[l] }} />
                  {LEVEL_LABEL[l]}
                </span>
                <span className={s.conditionCount}>{counts[l]}</span>
                <span className={s.conditionHint}>{CONDITION_HINT[l]}</span>
              </button>
            ))}
          </div>
        )}
        {view !== "tags" && (
          <div className={s.filterBar}>
            <label className={s.searchField}>
              <Search />
              <span className="sr-only">Search parts, locations and notes</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search parts, locations, notes…"
                className={field}
              />
            </label>
            <label className={s.assetSelect}>
              <span className="sr-only">Asset</span>
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className={field}
              >
                <option value="all">All assets</option>
                {data.assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {(q ||
              assetId !== "all" ||
              (view === "overview" && status !== "all")) && (
              <button
                type="button"
                onClick={clearFilters}
                className={`${btnGhost} ${btnSmall}`}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mb-5 flex items-start justify-between gap-3 rounded-ctl border border-line bg-surface px-4 py-3 text-sm"
          >
            <p>{notice}</p>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"
            >
              <Close />
            </button>
          </div>
        )}
        {view !== "tags" && (
          <div className={view === "overview" ? s.dashboardColumns : undefined}>
            {view === "overview" && (
              <section aria-labelledby="assets-heading" className={s.panel}>
                <div className={s.panelHeading}>
                  <div>
                    <h2 id="assets-heading">Assets & parts</h2>
                    <p>
                      {status === "all"
                        ? "Ordered by condition. Select a part for details."
                        : `${LEVEL_LABEL[status]} · ${visibleComponents.length} matching parts`}
                    </p>
                  </div>
                </div>
                {groups.length ? (
                  <AssetOverview
                    groups={groups}
                    readings={data.readings}
                    nextSteps={data.next_steps}
                    events={data.events}
                    now={now}
                  />
                ) : (
                  <div className="py-10 text-sm text-muted">
                    <p>
                      {data.components.length
                        ? "No parts match these filters."
                        : "No parts on record yet. Add a part in AprilTags to get started."}
                    </p>
                    {filtered && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className={`${btnGhost} ${btnSmall} mt-4`}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}
            <section aria-labelledby="activity-heading" className={s.panel}>
              <div className={s.panelHeading}>
                <div>
                  <h2 id="activity-heading">
                    {view === "overview"
                      ? "Latest from the field"
                      : "Activity history"}
                  </h2>
                  <p>
                    {view === "overview"
                      ? "Recent notes, inspections, and repairs"
                      : `${visibleEvents.length} events · Expand a record to read or manage it`}
                  </p>
                </div>
                {view === "overview" && (
                  <button type="button" onClick={() => setView("activity")}>
                    View all <ArrowRight />
                  </button>
                )}
              </div>
              <ActivityFeed
                events={
                  view === "overview"
                    ? visibleEvents.slice(0, 5)
                    : visibleEvents
                }
                componentsById={componentsById}
                assetsById={assetsById}
                now={now}
                emptyMessage={
                  data.events.length
                    ? "No activity matches these filters."
                    : "Nothing recorded yet. Notes from the field show up here."
                }
                onDeleted={eventDeleted}
              />
            </section>
          </div>
        )}
        <div hidden={view !== "tags"} className={s.tagsPanel}>
          <TagManager
            assets={data.assets}
            components={data.components}
            tags={data.tags}
            tagsLive={data.tags_live}
            onChanged={async () => {
              await refresh();
            }}
          />
        </div>
        <footer className={s.footer}>
          <span>Machine Memory / Operator workspace</span>
          <span>Readings are simulated for this demo.</span>
        </footer>
      </main>
    </>
  );
}
