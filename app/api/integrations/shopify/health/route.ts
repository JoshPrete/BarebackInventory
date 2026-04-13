import { NextResponse } from "next/server";
import { getShopifyConfig } from "@/lib/shopify/config";
import { fetchShopifyShopName } from "@/lib/shopify/admin";

/**
 * GET /api/integrations/shopify/health
 * Returns whether Shopify env is set and whether the Admin API accepts the token.
 */
export async function GET() {
  const cfg = getShopifyConfig();
  if (!cfg) {
    return NextResponse.json({
      configured: false,
      shopDomain: null,
      shopName: null,
      apiReachable: false,
    });
  }

  let shopName: string | null = null;
  let apiReachable = false;
  try {
    shopName = await fetchShopifyShopName();
    apiReachable = shopName != null;
  } catch {
    apiReachable = false;
  }

  return NextResponse.json({
    configured: true,
    shopDomain: cfg.shopDomain,
    shopName,
    apiReachable,
    apiVersion: cfg.apiVersion,
  });
}
