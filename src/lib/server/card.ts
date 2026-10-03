import type { ComponentCard, MachineEvent, Role } from "@/lib/types";
import { getAsset, getComponent, getRecentEvents } from "./data";
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

  // Milestone 2, hardcoded version. The LLM replaces this next.
  const { summary, next_step } = placeholderText(component.name, role, recent_events);

  return {
    component,
    asset,
    role,
    summary,
    next_step,
    readings: readingsFor(componentId),
    recent_events,
  };
}

function placeholderText(
  name: string,
  role: Role,
  events: MachineEvent[],
): { summary: string; next_step: string } {
  const last = events[0];
  const lastLine = last
    ? `Last ${last.type} on ${last.created_at.slice(0, 10)}: ${last.summary}.`
    : "No history recorded yet.";

  if (role === "operator") {
    return {
      summary: `${name} is running normally. ${lastLine}`,
      next_step:
        "Keep an eye on it during your shift. Call maintenance if you notice leaks, new noises, or sluggish response.",
    };
  }
  return {
    summary: `${name}: no open faults. ${lastLine} ${events.length} event(s) on record.`,
    next_step:
      "Check readings against spec, confirm no active leaks, and log anything you touch as a note.",
  };
}
