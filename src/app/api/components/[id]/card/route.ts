import type { NextRequest } from "next/server";
import type { Role } from "@/lib/types";
import { buildCard } from "@/lib/server/card";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const roleParam = request.nextUrl.searchParams.get("role");
  const role: Role = roleParam === "technician" ? "technician" : "operator";

  const card = await buildCard(id, role);
  if (!card) {
    return Response.json({ error: `Unknown component: ${id}` }, { status: 404 });
  }
  return Response.json(card);
}
