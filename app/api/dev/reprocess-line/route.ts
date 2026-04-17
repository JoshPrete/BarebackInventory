/**
 * DEV-ONLY endpoint — not for production use.
 * POST /api/dev/reprocess-line
 * Body: { "manualSaleLineId": "<uuid>" }
 *
 * Re-runs packed stock and component deductions for an existing ManualSaleLine.
 * Both operations are idempotent: already-applied deductions are skipped and
 * reported via alreadyApplied / already_applied warnings in the response.
 */

import { NextResponse } from "next/server";
import { reprocessSaleLine } from "@/services/salesProcessingService";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const manualSaleLineId: unknown = body?.manualSaleLineId;

  if (typeof manualSaleLineId !== "string" || !manualSaleLineId) {
    return NextResponse.json({ error: "manualSaleLineId (string) required in body" }, { status: 400 });
  }

  try {
    const result = await reprocessSaleLine(manualSaleLineId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
