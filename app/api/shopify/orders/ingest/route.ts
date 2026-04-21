/**
 * POST /api/shopify/orders/ingest
 *
 * Real Shopify order ingestion endpoint — not dev-only.
 * Fetches orders from the Shopify Admin API and processes any that have not
 * already been imported into the internal sales ledger.
 *
 * Query params:
 *   since  — ISO 8601 date string; only fetch orders created at or after this
 *             timestamp. Omit to fetch all orders the adapter returns.
 *
 * Idempotency:
 *   - Orders are deduplicated by ManualSale.orderRef (= Shopify order GID).
 *     Re-ingesting the same orders is a no-op for already-imported orders.
 *   - Packed stock deductions are idempotent via PackedStockMovement.manualSaleLineId @unique.
 *   - Component deductions are idempotent via @@unique([manualSaleLineId, componentId]).
 *   - Calling this endpoint multiple times for the same orders is safe.
 */

import { NextResponse } from "next/server";
import { syncShopifyOrders } from "@/services/shopifyService";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since") ?? undefined;

  console.log(`[shopify/orders/ingest] POST received${since ? ` — since: ${since}` : " — no since filter"}`);

  try {
    const result = await syncShopifyOrders(since);
    const { ordersFetched, ordersImported, ordersSkipped, errors, ...rest } = result;

    console.log(`[shopify/orders/ingest] Result — fetched: ${ordersFetched}, imported: ${ordersImported}, skipped: ${ordersSkipped}, errors: ${errors.length}`);

    return NextResponse.json({
      ordersFetched,
      ordersImported,
      ordersSkipped,
      errors,
      ...rest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[shopify/orders/ingest] Unhandled error:", err);
    return NextResponse.json(
      { ordersFetched: 0, ordersImported: 0, ordersSkipped: 0, errors: [message] },
      { status: 500 },
    );
  }
}
