/**
 * Shopify Admin API configuration — client-credentials flow (Dev Dashboard app).
 *
 * Required env vars:
 *   SHOPIFY_SHOP          — store subdomain, e.g. "bareback-biltong"
 *   SHOPIFY_CLIENT_ID     — Dev Dashboard app client ID
 *   SHOPIFY_CLIENT_SECRET — Dev Dashboard app client secret
 *
 * Optional:
 *   SHOPIFY_API_VERSION   — defaults to 2025-01
 */
export type ShopifyConfig = {
  /** e.g. "bareback-biltong" */
  shop: string;
  /** Derived: bareback-biltong.myshopify.com */
  shopDomain: string;
  clientId: string;
  clientSecret: string;
  /** Admin API version path segment, e.g. 2025-01 */
  apiVersion: string;
};

const DEFAULT_API_VERSION = "2025-01";

export function getShopifyConfig(): ShopifyConfig | null {
  const shop = process.env.SHOPIFY_SHOP?.trim().toLowerCase();
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  const apiVersion =
    process.env.SHOPIFY_API_VERSION?.trim() || DEFAULT_API_VERSION;

  if (!shop || !clientId || !clientSecret) {
    return null;
  }

  return {
    shop,
    shopDomain: `${shop}.myshopify.com`,
    clientId,
    clientSecret,
    apiVersion,
  };
}

export function isShopifyConfigured(): boolean {
  return getShopifyConfig() !== null;
}
