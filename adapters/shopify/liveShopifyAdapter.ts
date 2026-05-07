/**
 * Live Shopify adapter — fetches products and orders from the Shopify Admin
 * GraphQL API. Only instantiated when Shopify credentials are present in the
 * environment; falls back to mockShopifyAdapter otherwise.
 *
 * Products: paginated at 10 products/request to stay under Shopify's 1000-point
 * GraphQL cost limit. Estimated cost per page ≈ 710 points:
 *   10 products × (1 + 10 variants × (1 variant + 1 inventoryItem + 5 inventoryLevels))
 *
 * Orders: fetches up to 250 paid orders from the last 30 days by default,
 * or since a provided ISO timestamp. Requires read_orders scope.
 */

import { shopifyAdminGraphql } from "@/lib/shopify/admin";
import type {
  ShopifyAdapter,
  ShopifyOrderRecord,
  ShopifyProductRecord,
  ShopifyVariantRecord,
} from "./types";

// ─── Products ─────────────────────────────────────────────────────────────────

// Products query — 10 per page to stay under Shopify's 1000-point cost limit.
// Estimated cost per page ≈ 710 points.
//
// NOTE: ProductVariant.inventoryQuantity was deprecated in API 2024-04 and
// returns null for inventory-tracked variants in 2025-01+. We use
// inventoryItem.inventoryLevels instead and sum available qty across locations.
const PRODUCTS_QUERY = `
  query GetProducts($cursor: String) {
    products(first: 10, after: $cursor) {
      edges {
        node {
          id
          title
          handle
          status
          variants(first: 10) {
            edges {
              node {
                id
                title
                sku
                price
                inventoryItem {
                  id
                  inventoryLevels(first: 5) {
                    edges {
                      node {
                        quantities(names: ["available"]) {
                          name
                          quantity
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

interface GqlVariantNode {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  inventoryItem: {
    id: string;
    inventoryLevels: {
      edges: {
        node: {
          quantities: { name: string; quantity: number }[];
        };
      }[];
    };
  } | null;
}

interface GqlProductNode {
  id: string;
  title: string;
  handle: string;
  status: string;
  variants: { edges: { node: GqlVariantNode }[] };
}

interface GqlProductsResponse {
  products: {
    edges: { node: GqlProductNode }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

function mapVariant(v: GqlVariantNode, productGid: string): ShopifyVariantRecord {
  // Sum available qty across all locations. inventoryItem is null when
  // Shopify is not managing inventory for this variant.
  const totalAvailable = v.inventoryItem
    ? v.inventoryItem.inventoryLevels.edges.reduce((sum, { node: level }) => {
        const available = level.quantities.find((q) => q.name === "available");
        return sum + (available?.quantity ?? 0);
      }, 0)
    : null;

  return {
    shopifyVariantGid: v.id,
    shopifyProductGid: productGid,
    title: v.title,
    sku: v.sku ?? null,
    price: v.price,
    inventoryQuantity: totalAvailable,
    inventoryItemGid: v.inventoryItem?.id ?? null,
  };
}

async function fetchAllProducts(): Promise<ShopifyProductRecord[]> {
  const allProducts: ShopifyProductRecord[] = [];
  let cursor: string | null = null;
  let page = 0;

  do {
    page++;
    const res: Awaited<ReturnType<typeof shopifyAdminGraphql<GqlProductsResponse>>> =
      await shopifyAdminGraphql<GqlProductsResponse>(PRODUCTS_QUERY, { cursor });

    if (res.errors?.length) {
      throw new Error(
        `Shopify products query failed (page ${page}): ${res.errors.map((e) => e.message).join(", ")}`,
      );
    }

    const pageData = res.data?.products;
    if (!pageData) break;

    const pageProducts: ShopifyProductRecord[] = pageData.edges.map(
      ({ node: p }) => ({
        shopifyProductGid: p.id,
        title: p.title,
        handle: p.handle,
        status: p.status,
        variants: p.variants.edges.map(({ node: v }) =>
          mapVariant(v, p.id),
        ),
      }),
    );

    console.log(
      `[shopify/products] Page ${page}: fetched ${pageProducts.length} product(s)`,
    );
    allProducts.push(...pageProducts);

    cursor = pageData.pageInfo.hasNextPage
      ? pageData.pageInfo.endCursor
      : null;
  } while (cursor !== null);

  console.log(
    `[shopify/products] Done — ${allProducts.length} product(s) total across ${page} page(s)`,
  );
  return allProducts;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

/**
 * Fetches paid orders. When sinceIso is omitted, defaults to 30 days ago so
 * the 14-day burn rate window is always covered with a buffer.
 *
 * Filter: financial_status:paid ensures only confirmed sales are imported.
 * Cancelled, refunded, and pending orders are excluded.
 */
const ORDERS_QUERY = `
  query GetOrders($query: String) {
    orders(first: 250, sortKey: PROCESSED_AT, reverse: true, query: $query) {
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          lineItems(first: 100) {
            edges {
              node {
                id
                variant { id }
                sku
                title
                quantity
              }
            }
          }
        }
      }
    }
  }
`;

interface GqlOrderNode {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string;
  lineItems: {
    edges: {
      node: {
        id: string;
        variant: { id: string } | null;
        sku: string | null;
        title: string;
        quantity: number;
      };
    }[];
  };
}

interface GqlOrdersResponse {
  orders: { edges: { node: GqlOrderNode }[] };
}

function defaultSinceIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

async function fetchAllOrders(sinceIso?: string): Promise<ShopifyOrderRecord[]> {
  const since = sinceIso || defaultSinceIso();
  // Shopify query filter: paid orders since the given date.
  const queryStr = `created_at:>=${since} financial_status:paid`;

  const res = await shopifyAdminGraphql<GqlOrdersResponse>(ORDERS_QUERY, { query: queryStr });
  if (res.errors?.length) {
    throw new Error(`Shopify orders query failed: ${res.errors.map((e) => e.message).join(", ")}`);
  }

  return (res.data?.orders.edges ?? []).map(({ node: o }): ShopifyOrderRecord => ({
    shopifyOrderGid: o.id,
    orderNumber: parseInt(o.name.replace(/\D/g, ""), 10) || 0,
    createdAt: o.createdAt,
    financialStatus: o.displayFinancialStatus,
    lineItems: o.lineItems.edges.map(({ node: li }) => ({
      shopifyLineItemGid: li.id,
      shopifyVariantGid: li.variant?.id ?? null,
      sku: li.sku,
      title: li.title,
      quantity: li.quantity,
    })),
  }));
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const liveShopifyAdapter: ShopifyAdapter = {
  fetchProducts: fetchAllProducts,
  fetchOrders: fetchAllOrders,
};
