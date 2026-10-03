import type { NextRequest } from "next/server";
import { CHAT_MAX_CHARS, CHAT_MAX_MESSAGES, type ChatMessage, type ChatRequest } from "@/lib/chat";
import { getAsset, getComponent, getRecentEvents, PROMPT_EVENTS } from "@/lib/server/data";
import { hasLlm, streamChat } from "@/lib/server/llm";
import { readingsFor } from "@/lib/server/readings";

// The reply streams for up to 45 s (see CHAT_TIMEOUT_MS in llm.ts).
export const maxDuration = 60;

/**
 * Live-view assistant. Body: ChatRequest. Response: text/plain, streamed as
 * the model writes it. 400 bad body, 404 unknown part, 503 no model.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    let body: Partial<ChatRequest> | null;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Body must be JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || !Array.isArray(body.messages)) {
      return Response.json({ error: "messages[] is required" }, { status: 400 });
    }
    const messages: ChatMessage[] = [];
    for (const m of body.messages.slice(-CHAT_MAX_MESSAGES)) {
      if (!m || typeof m !== "object") continue;
      const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
      const content = typeof m.content === "string" ? m.content.trim().slice(0, CHAT_MAX_CHARS) : "";
      if (!role || !content) continue;
      // Providers want strictly alternating turns starting with the user.
      const last = messages[messages.length - 1];
      if (last && last.role === role) last.content = `${last.content}\n${content}`;
      else if (role === "user" || messages.length > 0) messages.push({ role, content });
    }
    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return Response.json({ error: "The last message must be from the user" }, { status: 400 });
    }
    const author_role = body.author_role === "technician" ? "technician" : "operator";

    if (!hasLlm()) {
      return Response.json({ error: "No model is configured on the server." }, { status: 503 });
    }

    const component = await getComponent(id);
    if (!component) {
      return Response.json({ error: `Unknown component: ${id}` }, { status: 404 });
    }
    const [asset, history] = await Promise.all([
      getAsset(component.asset_id),
      getRecentEvents(id, PROMPT_EVENTS),
    ]);
    if (!asset) {
      return Response.json({ error: `Unknown component: ${id}` }, { status: 404 });
    }

    const readings = await readingsFor(id);
    const stream = await streamChat(component, asset, history, readings, author_role, messages);
    if (!stream) {
      return Response.json({ error: "The assistant couldn’t answer right now." }, { status: 502 });
    }
    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-accel-buffering": "no",
      },
    });
  } catch (cause) {
    console.error("[chat]", cause);
    return Response.json({ error: "The assistant couldn’t answer right now." }, { status: 500 });
  }
}
