"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { OPERATOR_PIN_HEADER } from "@/lib/operator";
import { labelSvgString } from "@/lib/tag-svg";
import type { Asset, Component, NewComponentRequest, NewComponentResponse, NewTagRequest, TagAssignment } from "@/lib/types";
import { forgetPin, loadPin, savePin } from "./operator-pin";
import TagImage from "./tag-image";

const button = "min-h-11 cursor-pointer rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60";
const ghost = `${button} border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800`;
const solid = `${button} bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200`;
const input = "min-h-11 w-full rounded-lg border border-neutral-400 bg-transparent px-3 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-600";

type Outcome = { kind: "ok"; text: string; componentId: string } | { kind: "error"; text: string } | null;

export default function TagManager({ assets, components, tags, tagsLive, onChanged }: {
  assets: Asset[];
  components: Component[];
  tags: TagAssignment[];
  tagsLive: boolean;
  onChanged: () => Promise<void>;
}) {
  const tagByComponent = new Map(tags.map((t) => [t.component_id, t.tag_id]));
  const assetsById = new Map(assets.map((a) => [a.id, a]));
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const untagged = components.filter((c) => !tagByComponent.has(c.id));

  async function operatorPost(url: string, body: NewComponentRequest | NewTagRequest, pin: string) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json", [OPERATOR_PIN_HEADER]: pin }, body: JSON.stringify(body) });
  }

  async function assign(component: Component, pin: string): Promise<"ok" | "pin" | "fail"> {
    setBusyId(component.id);
    setOutcome(null);
    try {
      const res = await operatorPost("/api/tags", { component_id: component.id }, pin);
      if (res.status === 401) return "pin";
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({ error: "" }))) as { error?: string };
        setOutcome({ kind: "error", text: error || "Couldn’t assign a tag. Try again." });
        return "fail";
      }
      const tag = (await res.json()) as TagAssignment;
      savePin(pin);
      await onChanged();
      setOutcome({ kind: "ok", text: `${component.name} is now tag ${tag.tag_id}. Print its label and stick it on.`, componentId: component.id });
      return "ok";
    } catch {
      setOutcome({ kind: "error", text: "Couldn’t reach the server. Check the connection and try again." });
      return "fail";
    } finally {
      setBusyId(null);
    }
  }

  function download(component: Component, tagId: number) {
    const blob = new Blob([labelSvgString(tagId, component.name, component.location)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tag-${tagId}-${component.id}.svg`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section aria-labelledby="tags-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="tags-heading" className="text-lg font-semibold">AprilTags</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">One 36h11 tag per part. Print at 60 mm on matte paper and keep the white border.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/labels" target="_blank" rel="noopener" className={`${ghost} inline-flex items-center`}>Print all labels</Link>
          <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className={solid}>{adding ? "Close" : "Add a part"}</button>
        </div>
      </div>

      {!tagsLive && (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          The tag table isn’t set up yet, so this shows the built-in map. Run the tags statement at the bottom of <code>supabase/schema.sql</code> before adding parts.
        </p>
      )}

      {adding && (
        <AddPartForm assets={assets} busy={busyId === "new"} onSubmit={async (body, pin) => {
          setBusyId("new");
          setOutcome(null);
          try {
            const res = await operatorPost("/api/components", body, pin);
            if (res.status === 401) return "pin";
            if (!res.ok) {
              const { error } = (await res.json().catch(() => ({ error: "" }))) as { error?: string };
              setOutcome({ kind: "error", text: error || "Couldn’t add the part. Try again." });
              return "fail";
            }
            const made = (await res.json()) as NewComponentResponse;
            savePin(pin);
            await onChanged();
            setOutcome({ kind: "ok", text: `Added ${made.component.name} as tag ${made.tag.tag_id}. Print its label and stick it on the part.`, componentId: made.component.id });
            setAdding(false);
            return "ok";
          } catch {
            setOutcome({ kind: "error", text: "Couldn’t reach the server. Check the connection and try again." });
            return "fail";
          } finally {
            setBusyId(null);
          }
        }} />
      )}

      {outcome && (
        <div role={outcome.kind === "ok" ? "status" : "alert"} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${outcome.kind === "ok" ? "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100" : "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"}`}>
          <p>{outcome.text}</p>
          {outcome.kind === "ok" && <Link href={`/labels?component=${encodeURIComponent(outcome.componentId)}`} target="_blank" rel="noopener" className={`${ghost} inline-flex items-center bg-white dark:bg-neutral-950`}>Print label</Link>}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[...untagged, ...components.filter((c) => tagByComponent.has(c.id))].map((component) => {
          const tagId = tagByComponent.get(component.id);
          const asset = assetsById.get(component.asset_id);
          return (
            <li key={component.id} className="flex gap-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
                {tagId === undefined
                  ? <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">No tag</div>
                  : <TagImage id={tagId} className="h-full w-full" title={`AprilTag ${tagId} for ${component.name}`} />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{component.name}</p>
                  <p className="truncate text-sm text-neutral-600 dark:text-neutral-300" title={component.location}>{component.location}</p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">{asset?.name ?? component.asset_id} · <span className="font-mono">{tagId === undefined ? "untagged" : `tag ${tagId}`}</span></p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tagId === undefined ? (
                    <AssignButton component={component} busy={busyId === component.id} onAssign={assign} />
                  ) : (
                    <>
                      <Link href={`/labels?component=${encodeURIComponent(component.id)}`} target="_blank" rel="noopener" className={`${ghost} inline-flex items-center`}>Print</Link>
                      <button type="button" onClick={() => download(component, tagId)} className={ghost}>Download SVG</button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AssignButton({ component, busy, onAssign }: {
  component: Component;
  busy: boolean;
  onAssign: (component: Component, pin: string) => Promise<"ok" | "pin" | "fail">;
}) {
  const [pin, setPin] = useState(() => loadPin());
  const [askPin, setAskPin] = useState(() => loadPin() === "");
  const [error, setError] = useState("");

  async function go(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pin.trim()) {
      setAskPin(true);
      setError("Enter the operator PIN.");
      return;
    }
    setError("");
    const result = await onAssign(component, pin.trim());
    if (result === "pin") {
      forgetPin();
      setPin("");
      setAskPin(true);
      setError("That PIN didn’t match.");
    }
  }

  return (
    <form onSubmit={go} className="flex flex-wrap items-center gap-2">
      {askPin && (
        <label className="sr-only" htmlFor={`pin-${component.id}`}>Operator PIN</label>
      )}
      {askPin && <input id={`pin-${component.id}`} type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Operator PIN" className={`${input} w-36 font-mono`} />}
      <button type="submit" disabled={busy} aria-busy={busy} className={solid}>{busy ? "Assigning…" : "Assign next free tag"}</button>
      {error && <p role="alert" className="w-full text-sm text-red-700 dark:text-red-300">{error}</p>}
    </form>
  );
}

function AddPartForm({ assets, busy, onSubmit }: {
  assets: Asset[];
  busy: boolean;
  onSubmit: (body: NewComponentRequest, pin: string) => Promise<"ok" | "pin" | "fail">;
}) {
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [pin, setPin] = useState(() => loadPin());
  const [askPin, setAskPin] = useState(() => loadPin() === "");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!assetId || !name.trim() || !location.trim()) {
      setError("Pick an asset and give the part a name and a location.");
      return;
    }
    if (!pin.trim()) {
      setAskPin(true);
      setError("Enter the operator PIN.");
      return;
    }
    setError("");
    const result = await onSubmit({ asset_id: assetId, name: name.trim(), location: location.trim() }, pin.trim());
    if (result === "pin") {
      forgetPin();
      setPin("");
      setAskPin(true);
      setError("That PIN didn’t match.");
    }
    if (result === "ok") {
      setName("");
      setLocation("");
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Add a part" className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-2 dark:border-neutral-800">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Asset
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={`${input} appearance-none bg-white dark:bg-neutral-950`}>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Part name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Coolant reservoir" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
        Where on the machine
        <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="Engine bay, passenger side, translucent tank" className={input} />
      </label>
      {askPin && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Operator PIN
          <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} className={`${input} font-mono`} />
        </label>
      )}
      {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-300">{error}</p>}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} aria-busy={busy} className={solid}>{busy ? "Adding…" : "Add part and assign tag"}</button>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">It gets the next free 36h11 id.</p>
      </div>
    </form>
  );
}
