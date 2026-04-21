/**
 * GET /api/cron/sync-orders
 *
 * Vercel Cron job — runs every 15 minutes (see vercel.json).
 * Pulls the most recent Shopify orders and imports any that are not yet
 * in the internal sales ledger.
 *
 * Security:
 *   Vercel automatically sets CRON_SECRET and sends it as
 *   "Authorization: Bearer <CRON_SECRET>" on every cron invocation.
 *   Requests without the correct header are rejected with 401.
 *   If CRON_SECRET is not set the check is skipped (local dev only).
 *
 * Idempotency:
 *   syncShopifyOrders() deduplicates by ManualSale.orderRef — safe to
 *   call multiple times for the same orders.
 *
 * Note: Vercel Cron requires a Pro plan or above.
 */

import { NextResponse } from "next/server";
import { syncShopifyOrders } from "@/services/shopifyService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify Vercel cron secret when set (always set in production by Vercel).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      console.warn("[cron/sync-orders] Rejected — invalid or missing CRON_SECRET");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  console.log("[cron/sync-orders] Starting scheduled order sync");

  try {
    const result = await syncShopifyOrders();
    console.log(
      `[cron/sync-orders] Done — fetched: ${result.ordersFetched}, ` +
      `imported: ${result.ordersImported}, skipped: ${result.ordersSkipped}, ` +
      `errors: ${result.errors.length}`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/sync-orders] Unhandled error:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
