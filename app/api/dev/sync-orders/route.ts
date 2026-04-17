/**
 * DEV-ONLY endpoint — not for production use.
 * POST /api/dev/sync-orders
 * Calls syncShopifyOrders() and returns the SyncOrdersResult as JSON.
 */

import { NextResponse } from "next/server";
import { syncShopifyOrders } from "@/services/shopifyService";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  const result = await syncShopifyOrders();
  return NextResponse.json(result);
}
