/**
 * POST /api/shopify/webhooks/orders/create
 *
 * Receives Shopify `orders/create` webhook events, verifies the HMAC
 * signature, and imports the order using the same recordShopifyOrder()
 * path as the polling ingest endpoint.
 *
 * Signature verification:
 *   Shopify signs the raw request body with SHOPIFY_CLIENT_SECRET using
 *   HMAC-SHA256 and sends the result (Base64-encoded) in the header
 *   X-Shopify-Hmac-SHA256. We recompute and compare with timingSafeEqual
 *   to prevent timing attacks.
 *
 * Idempotency:
 *   ManualSale.orderRef = Shopify order GID. Duplicate deliveries (Shopify
 *   guarantees at-least-once) return 200 with status "already_imported"
 *   without touching stock ledgers.
 *
 * Payload format:
 *   Webhooks use the Shopify REST shape (numeric IDs, snake_case).
 *   We convert numeric IDs to GID strings to match the GraphQL adapter's
 *   ShopifyOrderRecord contract before passing to recordShopifyOrder().
 */

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getShopifyConfig } from "@/lib/shopify/config";
import { prisma } from "@/lib/prisma";
import { recordShopifyOrder } from "@/services/salesProcessingService";
import type { ShopifyOrderRecord } from "@/adapters/shopify/types";

// ─── REST webhook payload shape ───────────────────────────────────────────────

interface WebhookLineItem {
  id: number;
  variant_id: number | null;
  sku: string | null;
  title: string;
  quantity: number;
}

interface WebhookOrderPayload {
  id: number;
  name: string;          // e.g. "#1004"
  created_at: string;    // ISO 8601
  financial_status: string;
  line_items: WebhookLineItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toGid(type: string, id: number): string {
  return `gid://shopify/${type}/${id}`;
}

function verifyHmac(rawBody: string, hmacHeader: string, secret: string): boolean {
  if (!hmacHeader) return false;
  const computed = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const cfg = getShopifyConfig();
  if (!cfg) {
    console.error("[shopify/webhook/orders/create] Shopify not configured");
    return NextResponse.json({ error: "Shopify not configured" }, { status: 500 });
  }

  // 1. Read raw body — must happen before any other body parsing.
  const rawBody = await request.text();

  // 2. Verify HMAC signature.
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256") ?? "";
  if (!verifyHmac(rawBody, hmacHeader, cfg.clientSecret)) {
    console.warn("[shopify/webhook/orders/create] Rejected — invalid HMAC signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Parse payload.
  let payload: WebhookOrderPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookOrderPayload;
  } catch {
    console.error("[shopify/webhook/orders/create] Invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderGid = toGid("Order", payload.id);
  console.log(`[shopify/webhook/orders/create] Received ${orderGid} (${payload.name})`);

  // 4. Idempotency check — Shopify delivers webhooks at-least-once.
  const existing = await prisma.manualSale.findFirst({
    where: { orderRef: orderGid },
    select: { id: true },
  });

  if (existing) {
    console.log(`[shopify/webhook/orders/create] ${orderGid} already imported — skipping`);
    return NextResponse.json({ ok: true, status: "already_imported", orderGid });
  }

  // 5. Map REST payload → ShopifyOrderRecord (same contract as GraphQL adapter).
  const order: ShopifyOrderRecord = {
    shopifyOrderGid: orderGid,
    orderNumber: parseInt(payload.name.replace(/\D/g, ""), 10) || 0,
    createdAt: payload.created_at,
    financialStatus: payload.financial_status?.toUpperCase() ?? "",
    lineItems: payload.line_items.map((li) => ({
      shopifyLineItemGid: toGid("LineItem", li.id),
      shopifyVariantGid: li.variant_id ? toGid("ProductVariant", li.variant_id) : null,
      sku: li.sku,
      title: li.title,
      quantity: li.quantity,
    })),
  };

  // 6. Import order — same path as polling ingest.
  try {
    const result = await recordShopifyOrder(order);
    console.log(
      `[shopify/webhook/orders/create] Imported ${orderGid} — ` +
      `lines: ${result.linesImported} imported, ${result.linesSkipped} skipped, ` +
      `deductionWarnings: ${result.deductionWarnings}`,
    );
    return NextResponse.json({ ok: true, status: "imported", orderGid, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[shopify/webhook/orders/create] Failed to import ${orderGid}:`, err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
