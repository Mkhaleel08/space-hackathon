import type { DashboardData } from "@/lib/types";
import { buildCard } from "./card";
import { listAssets, listComponents, listEvents } from "./data";
import { readingsFor } from "./readings";
import { tagsOrFallback } from "./tags";

/**
 * One payload for the operator dashboard. Next steps come from the operator
 * card, which is cached by history hash, so after the first load this is a
 * handful of fast reads. A part whose card fails just has no next step.
 */
export async function getDashboard(): Promise<DashboardData> {
  const [assets, components, events, { tags, live }] = await Promise.all([
    listAssets(),
    listComponents(),
    listEvents(),
    tagsOrFallback(),
  ]);
  const readings = Object.fromEntries(components.map((c) => [c.id, readingsFor(c.id)]));
  const cards = await Promise.allSettled(components.map((c) => buildCard(c.id, "operator")));
  const next_steps: Record<string, string> = {};
  cards.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value) next_steps[components[i].id] = result.value.next_step;
  });
  return { assets, components, events, readings, next_steps, tags, tags_live: live, generated_at: new Date().toISOString() };
}
