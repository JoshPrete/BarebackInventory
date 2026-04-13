/**
 * Single-store Shopify Admin API configuration (custom/private app or dev store).
 * OAuth-based multi-tenant apps will replace env tokens with per-shop sessions later.
 */
export type ShopifyConfig = {
  /** e.g. bareback-biltong.myshopify.com */
  shopDomain: string;
  adminAccessToken: string;
  /** Admin API version path segment, e.g. 2025-01 */
  apiVersion: string;
};

const DEFAULT_API_VERSION = "2025-01";

export function getShopifyConfig(): ShopifyConfig | null {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN?.trim().toLowerCase();
  const adminAccessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  const apiVersion =
    process.env.SHOPIFY_API_VERSION?.trim() || DEFAULT_API_VERSION;

  if (!shopDomain || !adminAccessToken) {
    return null;
  }

  return { shopDomain, adminAccessToken, apiVersion };
}

export function isShopifyConfigured(): boolean {
  return getShopifyConfig() !== null;
}
