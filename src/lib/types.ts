/**
 * Shared contract between frontend and backend.
 *
 * SHARED FILE. Changing a type here changes what the API returns and what the
 * cards render. Tell the other two before you edit it, then merge fast.
 */

export type Role = "operator" | "technician";

export type EventType = "fault" | "repair" | "inspection" | "note";

export interface Asset {
  id: string;
  name: string; // e.g. "Cat 320 Excavator #4471"
  model: string;
  hours: number; // engine hours
}

export interface Component {
  id: string; // what an AprilTag number maps to (src/lib/markers.ts)
  asset_id: string;
  name: string; // e.g. "Hydraulic pump"
  location: string; // where on the machine, for the card header
}

export interface MachineEvent {
  id: string;
  component_id: string;
  type: EventType;
  summary: string; // one line, human readable
  detail: string | null; // raw note text or structured detail
  author_role: Role;
  created_at: string; // ISO 8601
  readings?: Reading[] | null; // snapshot when the note was saved; absent on seeded rows
}

/** Live reading shown on the card. Simulated for the demo. */
export interface Reading {
  label: string; // "Pressure"
  value: string; // "3,100 psi"
  status: "ok" | "watch" | "alert";
}

/** What GET /api/components/[id]/card returns. One card per role. */
export interface ComponentCard {
  component: Component;
  asset: Asset;
  role: Role;
  summary: string; // LLM-written, 2-3 sentences, worded for the role
  next_step: string; // LLM-written, one imperative sentence
  readings: Reading[];
  recent_events: MachineEvent[]; // newest first, max 5
  checklist: ChecklistItem[]; // LLM-written inspection steps for the role, 4 to 6, history first
}

/** One step of the card's inspection checklist. Checked state lives on the phone. */
export interface ChecklistItem {
  id: string; // the step text; a regenerated list only keeps ticks on unchanged steps
  text: string; // imperative, under 80 characters
}

/** Body for POST /api/components/[id]/notes */
export interface NewNoteRequest {
  text: string; // spoken or typed, raw
  author_role: Role;
}

/** Response for POST /api/components/[id]/notes */
export interface NewNoteResponse {
  event: MachineEvent; // the structured event the LLM produced
}

/**
 * What GET /api/dashboard returns: everything the operator dashboard shows in
 * one trip. Readings are keyed by component id; a missing or empty list means
 * no telemetry for that part, which the UI shows as "No readings", never as
 * healthy.
 */
export interface DashboardData {
  assets: Asset[];
  components: Component[];
  events: MachineEvent[]; // newest first, across all parts, capped server-side
  readings: Record<string, Reading[]>;
  next_steps: Record<string, string>; // operator wording, from the card cache when warm
  tags: TagAssignment[];
  tags_live: boolean; // false while the tags table is missing and the static map is in use
  generated_at: string; // ISO 8601
}

/** Response for DELETE /api/events/[id] (needs the operator PIN header). */
export interface DeleteEventResponse {
  deleted: MachineEvent;
}

/** One printed AprilTag (36h11 id) bound to one component. From GET /api/tags. */
export interface TagAssignment {
  tag_id: number; // 0–586
  component_id: string;
}

/** Body for POST /api/components (needs the operator PIN header). */
export interface NewComponentRequest {
  asset_id: string;
  name: string;
  location: string;
}

/** Response for POST /api/components: the part plus its freshly assigned tag. */
export interface NewComponentResponse {
  component: Component;
  tag: TagAssignment;
}

/** Body for POST /api/tags (needs the operator PIN header): assign the next free id. */
export interface NewTagRequest {
  component_id: string;
}
