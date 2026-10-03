import type { MachineEvent, NewNoteRequest } from "@/lib/types";
import { getComponent, insertEvent } from "./data";
import { extractReadingUpdates, structureNote } from "./llm";
import { readingsFor, updateReadings } from "./readings";

/**
 * Save a note. The text is also read for measurements against the part's
 * current readings ("inner pad is at 3.5 mm" updates Inner pad), and the
 * event keeps a snapshot of the readings as they stood after the save.
 */
export async function addNote(
  componentId: string,
  body: NewNoteRequest,
): Promise<MachineEvent | null> {
  const component = await getComponent(componentId);
  if (!component) return null;
  const current = await readingsFor(componentId);
  const [{ type, summary }, updates] = await Promise.all([
    structureNote(body.text, body.author_role, component),
    extractReadingUpdates(body.text, current, component),
  ]);
  const readings = updates.length > 0 ? await updateReadings(componentId, updates) : current;
  return insertEvent({
    component_id: componentId,
    type,
    summary,
    detail: body.text,
    author_role: body.author_role,
    readings: readings.length > 0 ? readings : null,
  });
}
