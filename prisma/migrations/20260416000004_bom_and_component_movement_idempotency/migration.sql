-- Enforce one rule per (SKU, component) pair in the BOM.
CREATE UNIQUE INDEX "SKUComponentRule_skuId_componentId_key"
    ON "SKUComponentRule"("skuId", "componentId");

-- Add manualSaleLineId to StockMovement for component-level idempotency.
-- Nullable so RECEIPT and ADJUSTMENT rows are unaffected.
ALTER TABLE "StockMovement"
    ADD COLUMN "manualSaleLineId" TEXT;

-- Composite unique: at most one SALE deduction per (line, component).
-- Postgres composite unique constraints treat rows with any NULL column
-- as non-duplicate, so (NULL, componentId) rows coexist freely.
CREATE UNIQUE INDEX "StockMovement_manualSaleLineId_componentId_key"
    ON "StockMovement"("manualSaleLineId", "componentId");

-- FK from StockMovement.manualSaleLineId to ManualSaleLine.id.
ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_manualSaleLineId_fkey"
    FOREIGN KEY ("manualSaleLineId")
    REFERENCES "ManualSaleLine"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
