/**
 * DEV-ONLY endpoint — not for production use.
 * POST /api/dev/sync-catalog
 *
 * Triggers syncShopifyCatalog() and returns the result.
 */

import { NextResponse } from "next/server";
import { syncShopifyCatalog } from "@/services/shopifyService";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  try {
    const result = await syncShopifyCatalog();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
