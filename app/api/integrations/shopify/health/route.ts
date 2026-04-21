import { NextResponse } from "next/server";
import { getShopifyConfig } from "@/lib/shopify/config";
import { getAccessToken } from "@/lib/shopify/auth";
import { shopifyAdminGraphql } from "@/lib/shopify/admin";

const PRODUCTS_PROBE = `
  query {
    products(first: 3) {
      edges {
        node {
          id
          title
        }
      }
    }
  }
`;

interface ProductsProbeResponse {
  products: { edges: { node: { id: string; title: string } }[] };
}

/**
 * GET /api/integrations/shopify/health
 *
 * Validates the Shopify client-credentials integration end-to-end:
 *   1. Checks env vars are present (configured)
 *   2. Acquires an access token via client_credentials grant
 *   3. Runs a lightweight Admin GraphQL products probe
 *
 * Never returns the access token itself.
 */
export async function GET() {
  try {
    return await handler();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[shopify/health] Unhandled error:", err);
    return NextResponse.json(
      { configured: false, shop: null, authSucceeded: false, productsReachable: false, productTitles: [], errors: [`Unhandled error: ${msg}`] },
      { status: 500 },
    );
  }
}

async function handler() {
  const cfg = getShopifyConfig();

  if (!cfg) {
    return NextResponse.json({
      configured: false,
      shop: null,
      authSucceeded: false,
      productsReachable: false,
      productTitles: [],
      errors: ["Shopify not configured — set SHOPIFY_SHOP, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET"],
    });
  }

  // ── Step 1: token acquisition ─────────────────────────────────────────────
  let authSucceeded = false;
  const errors: string[] = [];

  try {
    await getAccessToken(cfg);
    authSucceeded = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Auth failed: ${msg}`);
  }

  if (!authSucceeded) {
    return NextResponse.json({
      configured: true,
      shop: cfg.shop,
      shopDomain: cfg.shopDomain,
      apiVersion: cfg.apiVersion,
      authSucceeded: false,
      productsReachable: false,
      productTitles: [],
      errors,
    });
  }

  // ── Step 2: Admin GraphQL products probe ──────────────────────────────────
  let productsReachable = false;
  let productTitles: string[] = [];

  try {
    const res = await shopifyAdminGraphql<ProductsProbeResponse>(PRODUCTS_PROBE);
    if (res.errors?.length) {
      errors.push(
        `GraphQL errors: ${res.errors.map((e) => e.message).join(", ")}`,
      );
    } else {
      productTitles = (res.data?.products.edges ?? []).map((e) => e.node.title);
      productsReachable = true;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Products query failed: ${msg}`);
  }

  return NextResponse.json({
    configured: true,
    shop: cfg.shop,
    shopDomain: cfg.shopDomain,
    apiVersion: cfg.apiVersion,
    authSucceeded,
    productsReachable,
    productTitles,
    errors,
  });
}
