/**
 * E2E check: ensures packed stock, records a test sale (ORIGINAL-35G × 2),
 * verifies packed deduction only (no component movements on this sale).
 * Run: npx tsx scripts/verify-test-sale-e2e.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDatabaseUrlFromEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== "DATABASE_URL") continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env.DATABASE_URL = val;
    return;
  }
  throw new Error("DATABASE_URL not found in .env");
}

loadDatabaseUrlFromEnvFile();

const ORDER_REF = "VERIFY-E2E-ORIGINAL-35G-Q2";
const QTY = 2;

async function main() {
  const { prisma } = await import("../lib/prisma");
  const { recordManualSale } = await import("../lib/record-manual-sale");
  const { recordPackingRun } = await import("../lib/record-packing-run");

  const sku = await prisma.sellableSKU.findUnique({
    where: { sku: "ORIGINAL-35G" },
  });
  if (!sku) {
    console.error("Missing SKU ORIGINAL-35G. Run seed:35g or similar.");
    process.exit(1);
  }

  const onHandAgg = await prisma.packedStockMovement.aggregate({
    where: { sellableSkuId: sku.id },
    _sum: { qtyChange: true },
  });
  let onHand = onHandAgg._sum.qtyChange ?? 0;

  if (onHand < QTY) {
    const packQty = QTY - onHand;
    const pr = await prisma.$transaction(async (tx) =>
      recordPackingRun(tx, {
        sellableSkuId: sku.id,
        quantity: packQty,
        note: "verify-test-sale-e2e seed pack",
      }),
    );
    if (!pr.ok) {
      console.error("Could not seed packed stock via packing:", pr.error);
      process.exit(1);
    }
    console.log("Seeded packed stock via packing run:", packQty);
    onHand = QTY;
  }

  let sale = await prisma.manualSale.findFirst({
    where: { orderRef: ORDER_REF },
  });

  if (!sale) {
    const result = await prisma.$transaction(async (tx) =>
      recordManualSale(tx, {
        sellableSkuId: sku.id,
        quantity: QTY,
        orderRef: ORDER_REF,
      }),
    );
    if (!result.ok) {
      console.error(result.error);
      process.exit(1);
    }
    sale = await prisma.manualSale.findUniqueOrThrow({ where: { id: result.manualSaleId } });
    console.log("Created test sale:", sale.id);
  } else {
    console.log("Test sale already exists:", sale.id);
  }

  const compMoves = await prisma.stockMovement.findMany({
    where: { manualSaleId: sale.id },
  });
  if (compMoves.length !== 0) {
    console.error(
      "Expected no component StockMovement for this sale (packed-only model), got",
      compMoves.length,
    );
    process.exit(1);
  }

  const packed = await prisma.packedStockMovement.findMany({
    where: { manualSaleId: sale.id },
  });
  if (packed.length !== 1) {
    console.error("Expected 1 PackedStockMovement for sale, got", packed.length);
    process.exit(1);
  }
  const p = packed[0];
  if (p.qtyChange !== -QTY || p.type !== "SALE" || p.sourceType !== "manual_sale") {
    console.error("Unexpected packed movement:", p);
    process.exit(1);
  }

  console.log("OK: sale deducts packed stock only; PackedStockMovement verified.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
