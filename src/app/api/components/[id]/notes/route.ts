import type { NextRequest } from "next/server";
import type { NewNoteRequest, NewNoteResponse } from "@/lib/types";
import { addNote } from "@/lib/server/notes";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: Partial<NewNoteRequest>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const author_role =
    body.author_role === "technician" ? "technician" : "operator";
  if (!text) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  const event = await addNote(id, { text, author_role });
  if (!event) {
    return Response.json({ error: `Unknown component: ${id}` }, { status: 404 });
  }
  const res: NewNoteResponse = { event };
  return Response.json(res, { status: 201 });
}
