-- Add sourceSkuId to Component so auto-created components can be linked back
-- to the Shopify product that triggered their creation.
-- Nullable + unique: at most one component per source SKU; null for manually-added components.

ALTER TABLE "Component" ADD COLUMN "sourceSkuId" TEXT;

ALTER TABLE "Component"
  ADD CONSTRAINT "Component_sourceSkuId_key" UNIQUE ("sourceSkuId");

ALTER TABLE "Component"
  ADD CONSTRAINT "Component_sourceSkuId_fkey"
  FOREIGN KEY ("sourceSkuId") REFERENCES "SellableSKU"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Component_sourceSkuId_idx" ON "Component"("sourceSkuId");
