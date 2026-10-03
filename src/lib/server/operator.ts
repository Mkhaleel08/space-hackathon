import { createHash, timingSafeEqual } from "node:crypto";
import { OPERATOR_PIN_HEADER } from "@/lib/operator";

/**
 * Returns an error response when the request may not perform an operator
 * action, or null when it may. 503 when the deployment has no PIN at all, so a
 * missing env var fails closed instead of open.
 */
export function operatorGate(request: Request): Response | null {
  const expected = process.env.OPERATOR_PIN?.trim();
  if (!expected) {
    return Response.json(
      { error: "Operator actions are switched off: OPERATOR_PIN is not set on this deployment." },
      { status: 503 },
    );
  }
  const given = request.headers.get(OPERATOR_PIN_HEADER)?.trim() ?? "";
  if (!same(given, expected)) {
    return Response.json({ error: "Wrong operator PIN." }, { status: 401 });
  }
  return null;
}

function same(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
