import type { NextRequest } from "next/server";
import type { Role } from "@/lib/types";
import { buildCard } from "@/lib/server/card";

// The card may wait on one LLM call (capped at 12 s in llm.ts).
export const maxDuration = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const roleParam = request.nextUrl.searchParams.get("role");
    const role: Role = roleParam === "technician" ? "technician" : "operator";

    const card = await buildCard(id, role);
    if (!card) {
      return Response.json({ error: `Unknown component: ${id}` }, { status: 404 });
    }
    return Response.json(card);
  } catch (cause) {
    console.error("[card]", cause);
    return Response.json({ error: "Could not load this part." }, { status: 500 });
  }
}
