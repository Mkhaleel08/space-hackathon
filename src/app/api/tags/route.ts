import type { NextRequest } from "next/server";
import type { NewTagRequest } from "@/lib/types";
import { operatorGate } from "@/lib/server/operator";
import { assignTag, TagError, tagsOrFallback } from "@/lib/server/tags";
import { TagsTableMissing } from "@/lib/server/data";

export const dynamic = "force-dynamic";

/** The live tag map. Falls back to src/lib/markers.ts until the table exists. */
export async function GET() {
  const { tags, live } = await tagsOrFallback();
  return Response.json(tags, { headers: { "x-tags-source": live ? "table" : "fallback" } });
}

/** Assign the next free id to a part that has no tag yet. */
export async function POST(request: NextRequest) {
  const denied = operatorGate(request);
  if (denied) return denied;
  let body: Partial<NewTagRequest>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const component_id = typeof body.component_id === "string" ? body.component_id.trim() : "";
  if (!component_id) return Response.json({ error: "component_id is required" }, { status: 400 });
  try {
    return Response.json(await assignTag(component_id), { status: 201 });
  } catch (cause) {
    if (cause instanceof TagError) return Response.json({ error: cause.message }, { status: cause.status });
    if (cause instanceof TagsTableMissing) return Response.json({ error: cause.message }, { status: 503 });
    throw cause;
  }
}
