/**
 * Live Shopify adapter — fetches products and orders from the Shopify Admin
 * GraphQL API. Only instantiated when SHOPIFY_ADMIN_ACCESS_TOKEN and
 * SHOPIFY_SHOP_DOMAIN are present in the environment; falls back to
 * mockShopifyAdapter otherwise.
 *
 * Pagination: fetches up to 250 products (100 variants each) and 250 orders
 * in a single page. Cursor-based pagination can be added later if the store
 * grows beyond these limits.
 */

import { shopifyAdminGraphql } from "@/lib/shopify/admin";
import type {
  ShopifyAdapter,
  ShopifyOrderRecord,
  ShopifyProductRecord,
  ShopifyVariantRecord,
} from "./types";

// ─── Products ─────────────────────────────────────────────────────────────────

const PRODUCTS_QUERY = `
  query GetProducts($cursor: String) {
    products(first: 250, after: $cursor) {
      edges {
        node {
          id
          title
          handle
          status
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price
                inventoryItem { id }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

interface GqlProductNode {
  id: string;
  title: string;
  handle: string;
  status: string;
  variants: {
    edges: {
      node: {
        id: string;
        title: string;
        sku: string | null;
        price: string;
        inventoryItem: { id: string } | null;
      };
    }[];
  };
}

interface GqlProductsResponse {
  products: {
    edges: { node: GqlProductNode }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

async function fetchAllProducts(): Promise<ShopifyProductRecord[]> {
  const res = await shopifyAdminGraphql<GqlProductsResponse>(PRODUCTS_QUERY);
  if (res.errors?.length) {
    throw new Error(`Shopify products query failed: ${res.errors.map((e) => e.message).join(", ")}`);
  }

  return (res.data?.products.edges ?? []).map(({ node: p }): ShopifyProductRecord => ({
    shopifyProductGid: p.id,
    title: p.title,
    handle: p.handle,
    status: p.status,
    variants: p.variants.edges.map(({ node: v }): ShopifyVariantRecord => ({
      shopifyVariantGid: v.id,
      shopifyProductGid: p.id,
      title: v.title,
      sku: v.sku ?? null,
      price: v.price,
      inventoryItemGid: v.inventoryItem?.id ?? null,
    })),
  }));
}

// ─── Orders ──────────────────────────────────────────────────────────────────

// Fetch the 10 most recent orders (by processed_at desc).
// The `query` variable narrows by created_at when a `since` filter is passed.
const ORDERS_QUERY = `
  query GetOrders($query: String) {
    orders(first: 10, sortKey: PROCESSED_AT, reverse: true, query: $query) {
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
  /** Display name e.g. "#1001" — orderNumber field is not available to all app types. */
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

async function fetchAllOrders(sinceIso?: string): Promise<ShopifyOrderRecord[]> {
  const queryStr = sinceIso ? `created_at:>=${sinceIso}` : undefined;
  const res = await shopifyAdminGraphql<GqlOrdersResponse>(ORDERS_QUERY, { query: queryStr });
  if (res.errors?.length) {
    throw new Error(`Shopify orders query failed: ${res.errors.map((e) => e.message).join(", ")}`);
  }

  return (res.data?.orders.edges ?? []).map(({ node: o }): ShopifyOrderRecord => ({
    shopifyOrderGid: o.id,
    // Parse "#1001" → 1001; fall back to 0 if format differs.
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
