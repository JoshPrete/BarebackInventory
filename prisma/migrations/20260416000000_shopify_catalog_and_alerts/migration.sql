-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'REORDER_DUE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable: ShopifyProduct
CREATE TABLE "ShopifyProduct" (
    "id" TEXT NOT NULL,
    "shopifyProductGid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyProduct_shopifyProductGid_key" ON "ShopifyProduct"("shopifyProductGid");
CREATE INDEX "ShopifyProduct_shopifyProductGid_idx" ON "ShopifyProduct"("shopifyProductGid");

-- CreateTable: ShopifyVariant
CREATE TABLE "ShopifyVariant" (
    "id" TEXT NOT NULL,
    "shopifyVariantGid" TEXT NOT NULL,
    "shopifyProductGid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "price" TEXT NOT NULL,
    "inventoryItemGid" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyVariant_shopifyVariantGid_key" ON "ShopifyVariant"("shopifyVariantGid");
CREATE INDEX "ShopifyVariant_shopifyProductGid_idx" ON "ShopifyVariant"("shopifyProductGid");
CREATE INDEX "ShopifyVariant_sku_idx" ON "ShopifyVariant"("sku");

-- AddForeignKey
ALTER TABLE "ShopifyVariant" ADD CONSTRAINT "ShopifyVariant_shopifyProductGid_fkey"
    FOREIGN KEY ("shopifyProductGid") REFERENCES "ShopifyProduct"("shopifyProductGid")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Alert
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "componentId" TEXT,
    "sellableSkuId" TEXT,
    "currentLevel" DOUBLE PRECISION NOT NULL,
    "reorderPoint" DOUBLE PRECISION NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_resolvedAt_idx" ON "Alert"("resolvedAt");
CREATE INDEX "Alert_componentId_idx" ON "Alert"("componentId");
CREATE INDEX "Alert_sellableSkuId_idx" ON "Alert"("sellableSkuId");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_componentId_fkey"
    FOREIGN KEY ("componentId") REFERENCES "Component"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_sellableSkuId_fkey"
    FOREIGN KEY ("sellableSkuId") REFERENCES "SellableSKU"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
