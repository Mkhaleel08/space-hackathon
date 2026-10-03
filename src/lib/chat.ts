import type { Role } from "./types";

/**
 * Shapes for POST /api/components/[id]/chat (the live-view assistant).
 * Kept out of types.ts so the shared contract file stays untouched; move
 * them there if the team agrees.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Body for POST /api/components/[id]/chat. `messages` is the whole thread so far, oldest first, ending with the new user turn. */
export interface ChatRequest {
  messages: ChatMessage[];
  author_role: Role;
}

export const CHAT_MAX_MESSAGES = 24;
export const CHAT_MAX_CHARS = 2000;
