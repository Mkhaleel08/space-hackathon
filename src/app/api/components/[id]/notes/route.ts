import type { NextRequest } from "next/server";
import type { NewNoteRequest, NewNoteResponse } from "@/lib/types";
import { addNote } from "@/lib/server/notes";

// Saving a note waits on one LLM call (capped at 12 s in llm.ts).
export const maxDuration = 30;

const MAX_NOTE_CHARS = 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    let body: Partial<NewNoteRequest> | null;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Body must be JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
    }
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const author_role =
      body.author_role === "technician" ? "technician" : "operator";
    if (!text) {
      return Response.json({ error: "text is required" }, { status: 400 });
    }
    if (text.length > MAX_NOTE_CHARS) {
      return Response.json(
        { error: `Note is too long. Keep it under ${MAX_NOTE_CHARS} characters.` },
        { status: 400 },
      );
    }

    const event = await addNote(id, { text, author_role });
    if (!event) {
      return Response.json({ error: `Unknown component: ${id}` }, { status: 404 });
    }
    const res: NewNoteResponse = { event };
    return Response.json(res, { status: 201 });
  } catch (cause) {
    console.error("[notes]", cause);
    return Response.json({ error: "Could not save this note." }, { status: 500 });
  }
}
