import type { Reading, Role } from "./types";

/**
 * Shapes for POST /api/components/[id]/chat (the live-view assistant).
 * Kept out of types.ts so the shared contract file stays untouched; move
 * them there if the team agrees.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Set by the client when the server reported reading changes for this turn. Never read by the server. */
  changes?: ReadingChange[];
}

/** One reading the chat changed because the user stated a measurement. */
export interface ReadingChange {
  label: string;
  from: string;
  to: string;
  status: Reading["status"];
}

/** JSON in the `x-readings-updated` response header, present only when a turn changed something. */
export interface ReadingsUpdated {
  changes: ReadingChange[];
  readings: Reading[]; // the full list after the change
}

export const READINGS_HEADER = "x-readings-updated";

/** Body for POST /api/components/[id]/chat. `messages` is the whole thread so far, oldest first, ending with the new user turn. */
export interface ChatRequest {
  messages: ChatMessage[];
  author_role: Role;
}

export const CHAT_MAX_MESSAGES = 24;
export const CHAT_MAX_CHARS = 2000;
