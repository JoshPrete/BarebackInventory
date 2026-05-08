-- CreateEnum
CREATE TYPE "SkuClassification" AS ENUM ('FINISHED_PRODUCT', 'BUNDLE', 'RAW_COMPONENT_SOLD', 'PACKAGING_ITEM', 'IGNORED');

-- AlterTable
ALTER TABLE "SellableSKU" ADD COLUMN "classification" "SkuClassification";
