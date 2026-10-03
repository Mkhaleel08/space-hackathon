import type {
  Asset,
  Component,
  EventType,
  MachineEvent,
  Role,
} from "@/lib/types";

// Thin LLM wrapper over fetch. Uses Anthropic if ANTHROPIC_API_KEY is set,
// else OpenAI if OPENAI_API_KEY is set, else returns null so callers fall
// back to hardcoded text. No SDK dependency on purpose.

export function hasLlm(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

async function complete(system: string, user: string): Promise<string | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  try {
    if (anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.LLM_MODEL || "claude-haiku-4-5-20251001",
          max_tokens: 400,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
      const json = await res.json();
      return json.content?.[0]?.text ?? null;
    }
    if (openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: process.env.LLM_MODEL || "gpt-4o-mini",
          max_tokens: 400,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
      const json = await res.json();
      return json.choices?.[0]?.message?.content ?? null;
    }
  } catch (err) {
    console.error("[llm]", err);
  }
  return null;
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function describeEvents(events: MachineEvent[]): string {
  if (events.length === 0) return "No events recorded.";
  return events
    .map((e) => {
      const when = e.created_at.slice(0, 16).replace("T", " ");
      const detail = e.detail ? ` (${e.detail})` : "";
      return `- ${when} [${e.type}, by ${e.author_role}] ${e.summary}${detail}`;
    })
    .join("\n");
}

export async function writeCard(
  component: Component,
  asset: Asset,
  events: MachineEvent[],
  role: Role,
): Promise<{ summary: string; next_step: string } | null> {
  const audience =
    role === "operator"
      ? "an equipment OPERATOR: plain language, no jargon, what to watch or listen for during the shift, and when to call maintenance"
      : "a field TECHNICIAN: specific, name parts and symptoms, reference the last repair or fault, and say what to check first";
  const system = `You write short maintenance cards for heavy equipment. Respond with JSON only: {"summary": string, "next_step": string}. Each value is 1 to 2 sentences, under 220 characters. Write for ${audience}. Base everything on the event history; if a recent note reports a problem, the card must reflect it.`;
  const user = [
    `Asset: ${asset.name} (${asset.model}, ${asset.hours} h)`,
    `Component: ${component.name}, located ${component.location}`,
    "Event history, newest first:",
    describeEvents(events),
  ].join("\n");
  const out = parseJson<{ summary?: string; next_step?: string }>(
    await complete(system, user),
  );
  if (!out?.summary || !out?.next_step) return null;
  return { summary: String(out.summary), next_step: String(out.next_step) };
}

const EVENT_TYPES: EventType[] = ["fault", "repair", "inspection", "note"];

export async function structureNote(
  text: string,
  role: Role,
  component: Component,
): Promise<{ type: EventType; summary: string }> {
  const fallback = { type: "note" as EventType, summary: text.trim().slice(0, 120) };
  const system = `You turn a spoken or typed field note about a machine component into a structured event. Respond with JSON only: {"type": "fault" | "repair" | "inspection" | "note", "summary": string}. "fault" = a problem observed, "repair" = work done to fix something, "inspection" = a check with findings, "note" = anything else. summary is one line under 100 characters, third person, past tense.`;
  const user = `Component: ${component.name}. Author role: ${role}.\nNote: ${JSON.stringify(text)}`;
  const out = parseJson<{ type?: string; summary?: string }>(
    await complete(system, user),
  );
  if (!out?.summary) return fallback;
  const type = EVENT_TYPES.includes(out.type as EventType)
    ? (out.type as EventType)
    : "note";
  return { type, summary: String(out.summary).slice(0, 160) };
}
