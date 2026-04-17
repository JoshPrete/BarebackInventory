-- Index ManualSale.orderRef so dedup lookups by Shopify order GID are fast.
CREATE INDEX "ManualSale_orderRef_idx" ON "ManualSale"("orderRef");
