import type { ComponentCard, MachineEvent, Role } from "@/lib/types";
import { getAsset, getComponent, getRecentEvents } from "./data";
import { writeCard } from "./llm";
import { readingsFor } from "./readings";

export async function buildCard(
  componentId: string,
  role: Role,
): Promise<ComponentCard | null> {
  const component = await getComponent(componentId);
  if (!component) return null;

  const [asset, recent_events] = await Promise.all([
    getAsset(component.asset_id),
    getRecentEvents(componentId),
  ]);
  if (!asset) return null;

  const text =
    (await writeCard(component, asset, recent_events, role)) ??
    placeholderText(component.name, role, recent_events);

  return {
    component,
    asset,
    role,
    summary: text.summary,
    next_step: text.next_step,
    readings: readingsFor(componentId),
    recent_events,
  };
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
  const open = events.find((e) => e.type === "fault");

  if (role === "operator") {
    return {
      summary: open
        ? `${name} has a reported problem: ${open.summary}. ${lastLine}`
        : `${name} is running normally. ${lastLine}`,
      next_step: open
        ? "Avoid heavy loads on this part and tell maintenance before your next shift."
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
