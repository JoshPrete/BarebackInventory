-- AlterTable: store Shopify inventoryQuantity on each synced variant.
-- Nullable so variants with tracking disabled don't block the upsert.
ALTER TABLE "ShopifyVariant" ADD COLUMN "inventoryQuantity" INTEGER;
