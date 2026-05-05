/**
 * Shopify adapter contract — all Shopify data flowing into this system
 * must be normalised into these types before touching any service layer.
 * The adapter interface is the seam between "Shopify shape" and
 * "internal shape"; swap mockShopifyAdapter for liveShopifyAdapter
 * without changing any service or action code.
 */

export interface ShopifyProductRecord {
  shopifyProductGid: string;
  title: string;
  handle: string;
  status: string;
  variants: ShopifyVariantRecord[];
}

export interface ShopifyVariantRecord {
  shopifyVariantGid: string;
  shopifyProductGid: string;
  title: string;
  sku: string | null;
  price: string;
  inventoryItemGid: string | null;
  /** Shopify inventoryQuantity at time of fetch. Null if inventory tracking is off. */
  inventoryQuantity: number | null;
}

export interface ShopifyOrderRecord {
  shopifyOrderGid: string;
  orderNumber: number;
  createdAt: string;
  financialStatus: string;
  lineItems: ShopifyOrderLineItem[];
}

export interface ShopifyOrderLineItem {
  shopifyLineItemGid: string;
  shopifyVariantGid: string | null;
  sku: string | null;
  title: string;
  quantity: number;
}

/**
 * The adapter interface every Shopify adapter must satisfy.
 * Implement this for mock and live adapters.
 */
export interface ShopifyAdapter {
  fetchProducts(): Promise<ShopifyProductRecord[]>;
  fetchOrders(sinceIso?: string): Promise<ShopifyOrderRecord[]>;
}
