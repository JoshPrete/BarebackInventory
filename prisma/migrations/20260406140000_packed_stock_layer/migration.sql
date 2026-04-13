-- CreateEnum
CREATE TYPE "PackedStockMovementType" AS ENUM ('PACK', 'SALE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "PackingRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "PackingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackedStockMovement" (
    "id" TEXT NOT NULL,
    "sellableSkuId" TEXT NOT NULL,
    "qtyChange" DOUBLE PRECISION NOT NULL,
    "type" "PackedStockMovementType" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "manualSaleId" TEXT,
    "packingRunId" TEXT,

    CONSTRAINT "PackedStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackedStockMovement_sellableSkuId_idx" ON "PackedStockMovement"("sellableSkuId");

-- CreateIndex
CREATE INDEX "PackedStockMovement_createdAt_idx" ON "PackedStockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "PackedStockMovement_manualSaleId_idx" ON "PackedStockMovement"("manualSaleId");

-- CreateIndex
CREATE INDEX "PackedStockMovement_packingRunId_idx" ON "PackedStockMovement"("packingRunId");

-- AddForeignKey
ALTER TABLE "PackedStockMovement" ADD CONSTRAINT "PackedStockMovement_sellableSkuId_fkey" FOREIGN KEY ("sellableSkuId") REFERENCES "SellableSKU"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackedStockMovement" ADD CONSTRAINT "PackedStockMovement_manualSaleId_fkey" FOREIGN KEY ("manualSaleId") REFERENCES "ManualSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackedStockMovement" ADD CONSTRAINT "PackedStockMovement_packingRunId_fkey" FOREIGN KEY ("packingRunId") REFERENCES "PackingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "packingRunId" TEXT;

-- CreateIndex
CREATE INDEX "StockMovement_packingRunId_idx" ON "StockMovement"("packingRunId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_packingRunId_fkey" FOREIGN KEY ("packingRunId") REFERENCES "PackingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
