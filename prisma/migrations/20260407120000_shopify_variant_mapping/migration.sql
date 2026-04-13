-- CreateTable
CREATE TABLE "ShopifyVariantMapping" (
    "id" TEXT NOT NULL,
    "sellableSkuId" TEXT NOT NULL,
    "shopifyVariantGid" TEXT NOT NULL,
    "shopifyInventoryItemGid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyVariantMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyVariantMapping_sellableSkuId_key" ON "ShopifyVariantMapping"("sellableSkuId");

-- CreateIndex
CREATE INDEX "ShopifyVariantMapping_shopifyVariantGid_idx" ON "ShopifyVariantMapping"("shopifyVariantGid");

-- AddForeignKey
ALTER TABLE "ShopifyVariantMapping" ADD CONSTRAINT "ShopifyVariantMapping_sellableSkuId_fkey" FOREIGN KEY ("sellableSkuId") REFERENCES "SellableSKU"("id") ON DELETE CASCADE ON UPDATE CASCADE;
