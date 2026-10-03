import type { NextRequest } from "next/server";
import type { NewComponentRequest } from "@/lib/types";
import { listComponents, TagsTableMissing } from "@/lib/server/data";
import { operatorGate } from "@/lib/server/operator";
import { addComponent, TagError } from "@/lib/server/tags";

export async function GET() {
  return Response.json(await listComponents());
}

/** Add a part under an asset. It gets the next free AprilTag id. */
export async function POST(request: NextRequest) {
  const denied = operatorGate(request);
  if (denied) return denied;
  let body: Partial<NewComponentRequest>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const asset_id = typeof body.asset_id === "string" ? body.asset_id.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const location = typeof body.location === "string" ? body.location.trim().slice(0, 120) : "";
  if (!asset_id || !name || !location) {
    return Response.json({ error: "asset_id, name and location are required" }, { status: 400 });
  }
  try {
    return Response.json(await addComponent({ asset_id, name, location }), { status: 201 });
  } catch (cause) {
    if (cause instanceof TagError) return Response.json({ error: cause.message }, { status: cause.status });
    if (cause instanceof TagsTableMissing) return Response.json({ error: cause.message }, { status: 503 });
    throw cause;
  }
}
