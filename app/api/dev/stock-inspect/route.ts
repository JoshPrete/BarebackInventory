/**
 * DEV-ONLY endpoint — not for production use.
 * GET /api/dev/stock-inspect?skuId=<uuid>
 *
 * Returns packed stock on-hand and per-component on-hand (via BOM) for one SKU.
 */

import { NextResponse } from "next/server";
import { getStockSnapshotForSku } from "@/services/inventoryService";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const skuId = searchParams.get("skuId");

  if (!skuId) {
    return NextResponse.json({ error: "skuId query param required" }, { status: 400 });
  }

  try {
    const snapshot = await getStockSnapshotForSku(skuId);
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
