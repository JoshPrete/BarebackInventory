-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('BILTONG_BULK', 'PACKAGING');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'SALE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "unit" TEXT NOT NULL,
    "reorderPoint" DOUBLE PRECISION NOT NULL,
    "reorderQty" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "leadTimeDays" INTEGER,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellableSKU" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "isBundle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellableSKU_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SKUComponentRule" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "qtyPerUnit" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SKUComponentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleComponent" (
    "id" TEXT NOT NULL,
    "parentSkuId" TEXT NOT NULL,
    "childSkuId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "BundleComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "qtyChange" DOUBLE PRECISION NOT NULL,
    "sourceType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellableSKU_sku_key" ON "SellableSKU"("sku");

-- CreateIndex
CREATE INDEX "SKUComponentRule_skuId_idx" ON "SKUComponentRule"("skuId");

-- CreateIndex
CREATE INDEX "SKUComponentRule_componentId_idx" ON "SKUComponentRule"("componentId");

-- CreateIndex
CREATE INDEX "BundleComponent_parentSkuId_idx" ON "BundleComponent"("parentSkuId");

-- CreateIndex
CREATE INDEX "BundleComponent_childSkuId_idx" ON "BundleComponent"("childSkuId");

-- CreateIndex
CREATE INDEX "StockMovement_componentId_idx" ON "StockMovement"("componentId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "SKUComponentRule" ADD CONSTRAINT "SKUComponentRule_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "SellableSKU"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SKUComponentRule" ADD CONSTRAINT "SKUComponentRule_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_parentSkuId_fkey" FOREIGN KEY ("parentSkuId") REFERENCES "SellableSKU"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_childSkuId_fkey" FOREIGN KEY ("childSkuId") REFERENCES "SellableSKU"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;
