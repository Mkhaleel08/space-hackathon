"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { OPERATOR_PIN_HEADER } from "@/lib/operator";
import { labelSvgString } from "@/lib/tag-svg";
import type { Asset, Component, NewComponentRequest, NewComponentResponse, NewTagRequest, TagAssignment } from "@/lib/types";
import { forgetPin, loadPin, savePin } from "./operator-pin";
import TagImage from "./tag-image";
import { btnGhost, btnPrimary, btnSecondary, btnSmall, field, fieldLabel, h2, meta, section } from "../ui";

const ghost = `${btnGhost} ${btnSmall} disabled:cursor-wait`;
const solid = `${btnPrimary} ${btnSmall} disabled:cursor-wait`;
const input = field;

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
    <section aria-labelledby="tags-heading" className={`${section} flex flex-col gap-6`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id="tags-heading" className={h2}>AprilTags</h2>
          <p className={`${meta} mt-1`}>One 36h11 tag per part. Print at 60 mm on matte paper and keep the white border.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/labels" target="_blank" rel="noopener" className={ghost}>Print all labels</Link>
          <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className={`${btnSecondary} ${btnSmall}`}>{adding ? "Close" : "Add a part"}</button>
        </div>
      </div>

      {!tagsLive && (
        <p role="alert" className="border border-line bg-surface px-4 py-3 text-sm">
          <span className="font-medium text-watch">Built-in tag map in use.</span> The tag table isn’t set up yet. Run the tags statement at the bottom of <code className="font-mono text-xs">supabase/schema.sql</code> before adding parts.
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
        <div role={outcome.kind === "ok" ? "status" : "alert"} className="flex flex-wrap items-center justify-between gap-3 border border-line bg-surface px-4 py-3 text-sm">
          <p className="flex items-start gap-2.5"><span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 ${outcome.kind === "ok" ? "bg-accent" : "bg-alert"}`} />{outcome.text}</p>
          {outcome.kind === "ok" && <Link href={`/labels?component=${encodeURIComponent(outcome.componentId)}`} target="_blank" rel="noopener" className={ghost}>Print label</Link>}
        </div>
      )}

      <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-10 xl:grid-cols-3">
        {[...untagged, ...components.filter((c) => tagByComponent.has(c.id))].map((component) => {
          const tagId = tagByComponent.get(component.id);
          const asset = assetsById.get(component.asset_id);
          return (
            <li key={component.id} className="flex gap-4 border-b border-line py-4">
              <div className="h-20 w-20 shrink-0 border border-line bg-white">
                {tagId === undefined
                  ? <div className="flex h-full w-full items-center justify-center bg-surface text-xs text-muted">No tag</div>
                  : <TagImage id={tagId} className="h-full w-full" title={`AprilTag ${tagId} for ${component.name}`} />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{component.name}</p>
                  <p className="truncate text-sm text-muted" title={component.location}>{component.location}</p>
                  <p className="mt-0.5 text-xs text-muted">{asset?.name ?? component.asset_id} · <span className="font-mono">{tagId === undefined ? "untagged" : `tag ${tagId}`}</span></p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tagId === undefined ? (
                    <AssignButton component={component} busy={busyId === component.id} onAssign={assign} />
                  ) : (
                    <>
                      <Link href={`/labels?component=${encodeURIComponent(component.id)}`} target="_blank" rel="noopener" className={ghost}>Print</Link>
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
      {askPin && <input id={`pin-${component.id}`} type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Operator PIN" className={`${input} min-h-10 w-36 font-mono text-sm`} />}
      <button type="submit" disabled={busy} aria-busy={busy} className={solid}>{busy ? "Assigning…" : "Assign next free tag"}</button>
      {error && <p role="alert" className="w-full text-sm text-alert">{error}</p>}
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
    <form onSubmit={submit} noValidate aria-label="Add a part" className="grid gap-4 border border-line p-4 sm:grid-cols-2 sm:p-5">
      <label className={fieldLabel}>
        Asset
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={`${input} appearance-none`}>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label className={fieldLabel}>
        Part name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Coolant reservoir" className={input} />
      </label>
      <label className={`${fieldLabel} sm:col-span-2`}>
        Where on the machine
        <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="Engine bay, passenger side, translucent tank" className={input} />
      </label>
      {askPin && (
        <label className={fieldLabel}>
          Operator PIN
          <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} className={`${input} font-mono`} />
        </label>
      )}
      {error && <p role="alert" className="text-sm text-alert sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={busy} aria-busy={busy} className={`${btnPrimary} disabled:cursor-wait`}>{busy ? "Adding…" : "Add part and assign tag"}</button>
        <p className={meta}>It gets the next free 36h11 id.</p>
      </div>
    </form>
  );
}
