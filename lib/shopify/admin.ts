import { getShopifyConfig } from "./config";

export type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

/**
 * Shopify Admin GraphQL API (recommended for new integrations).
 * @see https://shopify.dev/docs/api/admin-graphql
 */
export async function shopifyAdminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<ShopifyGraphqlResponse<T>> {
  const cfg = getShopifyConfig();
  if (!cfg) {
    throw new Error("Shopify is not configured (set SHOPIFY_SHOP_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN).");
  }

  const url = `https://${cfg.shopDomain}/admin/api/${cfg.apiVersion}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": cfg.adminAccessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as ShopifyGraphqlResponse<T>;
  if (!res.ok) {
    throw new Error(
      `Shopify HTTP ${res.status}: ${JSON.stringify(json.errors ?? json)}`,
    );
  }
  return json;
}

/** Lightweight connectivity check: returns shop name if credentials work. */
export async function fetchShopifyShopName(): Promise<string | null> {
  const query = `query { shop { name } }`;
  const res = await shopifyAdminGraphql<{ shop: { name: string } }>(query);
  if (res.errors?.length) {
    return null;
  }
  return res.data?.shop?.name ?? null;
}
