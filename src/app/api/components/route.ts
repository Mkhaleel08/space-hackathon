import { listComponents } from "@/lib/server/data";

export async function GET() {
  return Response.json(await listComponents());
}
