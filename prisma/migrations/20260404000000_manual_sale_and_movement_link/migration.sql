-- CreateTable
CREATE TABLE "ManualSale" (
    "id" TEXT NOT NULL,
    "orderRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualSaleLine" (
    "id" TEXT NOT NULL,
    "manualSaleId" TEXT NOT NULL,
    "sellableSkuId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ManualSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualSale_createdAt_idx" ON "ManualSale"("createdAt");

-- CreateIndex
CREATE INDEX "ManualSaleLine_manualSaleId_idx" ON "ManualSaleLine"("manualSaleId");

-- CreateIndex
CREATE INDEX "ManualSaleLine_sellableSkuId_idx" ON "ManualSaleLine"("sellableSkuId");

-- AddForeignKey
ALTER TABLE "ManualSaleLine" ADD CONSTRAINT "ManualSaleLine_manualSaleId_fkey" FOREIGN KEY ("manualSaleId") REFERENCES "ManualSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualSaleLine" ADD CONSTRAINT "ManualSaleLine_sellableSkuId_fkey" FOREIGN KEY ("sellableSkuId") REFERENCES "SellableSKU"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "manualSaleId" TEXT;

-- CreateIndex
CREATE INDEX "StockMovement_manualSaleId_idx" ON "StockMovement"("manualSaleId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_manualSaleId_fkey" FOREIGN KEY ("manualSaleId") REFERENCES "ManualSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
