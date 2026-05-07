-- Create user-defined product categories table.
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");

-- Add nullable categoryId FK to SellableSKU.
ALTER TABLE "SellableSKU" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "SellableSKU_categoryId_idx" ON "SellableSKU"("categoryId");
ALTER TABLE "SellableSKU" ADD CONSTRAINT "SellableSKU_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
