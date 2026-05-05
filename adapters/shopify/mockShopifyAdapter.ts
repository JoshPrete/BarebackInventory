/**
 * Mock Shopify adapter — returns static fixture data so the service layer
 * can be developed and tested without real Shopify credentials.
 *
 * Replace with liveShopifyAdapter when SHOPIFY_ADMIN_ACCESS_TOKEN is set
 * and the team is ready to connect.
 */

import type {
  ShopifyAdapter,
  ShopifyOrderRecord,
  ShopifyProductRecord,
} from "./types";

const MOCK_PRODUCTS: ShopifyProductRecord[] = [
  {
    shopifyProductGid: "gid://shopify/Product/1000000001",
    title: "Bareback Biltong 100g",
    handle: "bareback-biltong-100g",
    status: "ACTIVE",
    variants: [
      {
        shopifyVariantGid: "gid://shopify/ProductVariant/2000000001",
        shopifyProductGid: "gid://shopify/Product/1000000001",
        title: "Default Title",
        sku: "BB-100G",
        price: "12.00",
        inventoryItemGid: "gid://shopify/InventoryItem/3000000001",
        inventoryQuantity: 10,
      },
    ],
  },
  {
    shopifyProductGid: "gid://shopify/Product/1000000002",
    title: "Bareback Biltong 250g",
    handle: "bareback-biltong-250g",
    status: "ACTIVE",
    variants: [
      {
        shopifyVariantGid: "gid://shopify/ProductVariant/2000000002",
        shopifyProductGid: "gid://shopify/Product/1000000002",
        title: "Default Title",
        sku: "BB-250G",
        price: "26.00",
        inventoryItemGid: "gid://shopify/InventoryItem/3000000002",
        inventoryQuantity: 5,
      },
    ],
  },
];

const MOCK_ORDERS: ShopifyOrderRecord[] = [
  {
    shopifyOrderGid: "gid://shopify/Order/5000000001",
    orderNumber: 1001,
    createdAt: "2026-04-10T09:00:00Z",
    financialStatus: "paid",
    lineItems: [
      {
        shopifyLineItemGid: "gid://shopify/LineItem/6000000001",
        shopifyVariantGid: "gid://shopify/ProductVariant/2000000001",
        sku: "BB-100G",
        title: "Bareback Biltong 100g",
        quantity: 3,
      },
    ],
  },
];

export const mockShopifyAdapter: ShopifyAdapter = {
  async fetchProducts() {
    return MOCK_PRODUCTS;
  },
  async fetchOrders(_sinceIso?: string) {
    return MOCK_ORDERS;
  },
};
