import type { MachineEvent, NewNoteRequest } from "@/lib/types";
import { getComponent, insertEvent } from "./data";
import { structureNote } from "./llm";

export async function addNote(
  componentId: string,
  body: NewNoteRequest,
): Promise<MachineEvent | null> {
  const component = await getComponent(componentId);
  if (!component) return null;
  const { type, summary } = await structureNote(
    body.text,
    body.author_role,
    component,
  );
  return insertEvent({
    component_id: componentId,
    type,
    summary,
    detail: body.text,
    author_role: body.author_role,
  });
}
