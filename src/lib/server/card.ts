import { createHash } from "node:crypto";
import type {
  Asset,
  Component,
  ComponentCard,
  MachineEvent,
  Reading,
  Role,
} from "@/lib/types";
import {
  getAsset,
  getCachedCardText,
  getComponent,
  getRecentEvents,
  PROMPT_EVENTS,
  RECENT_EVENTS,
  saveCardText,
} from "./data";
import { writeCard } from "./llm";
import { readingsFor } from "./readings";

// Bump when the card prompt changes so old cached wording is not reused.
const PROMPT_VERSION = "v2";

export async function buildCard(
  componentId: string,
  role: Role,
): Promise<ComponentCard | null> {
  const component = await getComponent(componentId);
  if (!component) return null;

  // One read: the model gets the long history, the API returns the newest few.
  const [asset, history] = await Promise.all([
    getAsset(component.asset_id),
    getRecentEvents(componentId, PROMPT_EVENTS),
  ]);
  if (!asset) return null;

  const readings = await readingsFor(componentId);
  const text = await cardText(component, asset, history, readings, role);

  return {
    component,
    asset,
    role,
    summary: text.summary,
    next_step: text.next_step,
    readings,
    recent_events: history.slice(0, RECENT_EVENTS),
  };
}

// The LLM text is cached per component, role, and what the model was shown
// (history content and readings), so the same inputs always show the same
// wording and it only regenerates when a note is added. The key hashes event
// content, not event ids, so the wording also survives `npm run seed` (which
// assigns new ids).
async function cardText(
  component: Component,
  asset: Asset,
  events: MachineEvent[],
  readings: Reading[],
  role: Role,
): Promise<{ summary: string; next_step: string }> {
  const key = cacheKey(component, asset, events, readings, role);
  const cached = await getCachedCardText(key);
  if (cached) return cached;

  const written = await writeCard(component, asset, events, readings, role);
  if (written) {
    await saveCardText(key, written);
    return written;
  }
  // LLM unavailable: do not cache the placeholder, try again next request.
  return placeholderText(component.name, role, events);
}

function cacheKey(
  component: Component,
  asset: Asset,
  events: MachineEvent[],
  readings: Reading[],
  role: Role,
): string {
  const content = JSON.stringify([
    PROMPT_VERSION,
    asset.name,
    asset.model,
    asset.hours,
    component.name,
    component.location,
    readings.map((r) => [r.label, r.value, r.status]),
    events.map((e) => [
      e.type,
      e.summary,
      e.detail,
      e.author_role,
      new Date(e.created_at).toISOString(),
    ]),
  ]);
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 32);
  return `${component.id}:${role}:${hash}`;
}

// Used when no LLM key is set or the call fails. Keeps the demo alive.
function placeholderText(
  name: string,
  role: Role,
  events: MachineEvent[],
): { summary: string; next_step: string } {
  const last = events[0];
  const lastLine = last
    ? `Last ${last.type} on ${last.created_at.slice(0, 10)}: ${last.summary}.`
    : "No history recorded yet.";
  // Events are newest first. A fault is open only if no repair came after it.
  const latest = events.find((e) => e.type === "fault" || e.type === "repair");
  const open = latest?.type === "fault" ? latest : undefined;

  if (role === "operator") {
    return {
      summary: open
        ? `${name} has a reported problem: ${open.summary}. ${lastLine}`
        : `${name} has no open faults. ${lastLine}`,
      next_step: open
        ? "Go easy on this part and tell maintenance before your next shift."
        : "Keep an eye on it during your shift. Call maintenance if you notice leaks, new noises, or sluggish response.",
    };
  }
  const status = open ? `open fault, ${open.summary}` : "no open faults";
  return {
    summary: `${name}: ${status}. ${lastLine} ${events.length} event(s) on record.`,
    next_step: open
      ? `Start with the reported fault (${open.summary}), then verify readings against spec and log the repair.`
      : "Check readings against spec, confirm no active leaks, and log anything you touch as a note.",
  };
}
