import type { NextRequest } from "next/server";
import type { DeleteEventResponse } from "@/lib/types";
import { deleteEvent } from "@/lib/server/data";
import { operatorGate } from "@/lib/server/operator";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = operatorGate(request);
  if (denied) return denied;

  const { id } = await params;
  const deleted = await deleteEvent(id);
  if (!deleted) {
    return Response.json({ error: `Unknown event: ${id}` }, { status: 404 });
  }
  // The card cache is keyed by a hash of the history, so the next card read
  // for this part regenerates its summary and next step without this event.
  const res: DeleteEventResponse = { deleted };
  return Response.json(res);
}
