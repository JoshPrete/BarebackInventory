-- Add manualSaleLineId to PackedStockMovement as an idempotency key.
-- Nullable so existing PACK / ADJUSTMENT rows are unaffected.
-- The UNIQUE constraint ensures at most one SALE movement per ManualSaleLine.
-- Postgres unique constraints on nullable columns allow multiple NULLs.

ALTER TABLE "PackedStockMovement"
    ADD COLUMN "manualSaleLineId" TEXT;

ALTER TABLE "PackedStockMovement"
    ADD CONSTRAINT "PackedStockMovement_manualSaleLineId_key"
    UNIQUE ("manualSaleLineId");

ALTER TABLE "PackedStockMovement"
    ADD CONSTRAINT "PackedStockMovement_manualSaleLineId_fkey"
    FOREIGN KEY ("manualSaleLineId")
    REFERENCES "ManualSaleLine"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
