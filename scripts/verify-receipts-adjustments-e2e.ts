/**
 * Idempotent test receipts + adjustment; verifies net stock vs expected (with or without prior E2E sale).
 * Run: npx tsx scripts/verify-receipts-adjustments-e2e.ts
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

const RECEIPT_NOTE_TAG = "e2e-verify-receipt";
const ADJUST_NOTE = "damaged during packing test";

async function main() {
  const { prisma } = await import("../lib/prisma");
  const { StockMovementType } = await import("../app/generated/prisma/enums");

  const sale = await prisma.manualSale.findFirst({
    where: { orderRef: "VERIFY-E2E-ORIGINAL-35G-Q2" },
  });

  const receipts: { name: string; qty: number; tag: string }[] = [
    { name: "Original dried biltong", qty: 5000, tag: `${RECEIPT_NOTE_TAG}-biltong-5000` },
    { name: "35g pouch", qty: 200, tag: `${RECEIPT_NOTE_TAG}-35gpouch-200` },
    { name: "Original label", qty: 200, tag: `${RECEIPT_NOTE_TAG}-label-200` },
    { name: "absorber", qty: 200, tag: `${RECEIPT_NOTE_TAG}-absorber-200` },
  ];

  for (const r of receipts) {
    const comp = await prisma.component.findFirst({ where: { name: r.name } });
    if (!comp) {
      console.error("Missing component:", r.name);
      process.exit(1);
    }
    const exists = await prisma.stockMovement.findFirst({
      where: {
        componentId: comp.id,
        type: "RECEIPT",
        sourceType: "manual_receipt",
        note: r.tag,
      },
    });
    if (!exists) {
      await prisma.stockMovement.create({
        data: {
          componentId: comp.id,
          type: StockMovementType.RECEIPT,
          qtyChange: r.qty,
          sourceType: "manual_receipt",
          note: r.tag,
        },
      });
      console.log("Created receipt:", r.name, r.qty);
    }
  }

  const absorber = await prisma.component.findFirst({ where: { name: "absorber" } });
  if (!absorber) {
    console.error("Missing absorber component");
    process.exit(1);
  }

  const adjExists = await prisma.stockMovement.findFirst({
    where: {
      componentId: absorber.id,
      type: "ADJUSTMENT",
      sourceType: "manual_adjustment",
      qtyChange: -3,
      note: ADJUST_NOTE,
    },
  });

  if (!adjExists) {
    await prisma.stockMovement.create({
      data: {
        componentId: absorber.id,
        type: StockMovementType.ADJUSTMENT,
        qtyChange: -3,
        sourceType: "manual_adjustment",
        note: ADJUST_NOTE,
      },
    });
    console.log("Created adjustment: absorber -3");
  }

  const sums = await prisma.stockMovement.groupBy({
    by: ["componentId"],
    _sum: { qtyChange: true },
  });
  const byName = new Map<string, number>();
  for (const row of sums) {
    const c = await prisma.component.findUnique({
      where: { id: row.componentId },
      select: { name: true },
    });
    if (c) byName.set(c.name, row._sum.qtyChange ?? 0);
  }

  const expectedWithSale = {
    "Original dried biltong": 4930,
    "35g pouch": 198,
    "Original label": 198,
    absorber: 195,
  };
  const expectedNoSale = {
    "Original dried biltong": 5000,
    "35g pouch": 200,
    "Original label": 200,
    absorber: 197,
  };

  const expected = sale ? expectedWithSale : expectedNoSale;
  const label = sale ? "with VERIFY-E2E-ORIGINAL-35G-Q2 sale" : "without E2E sale";

  for (const [name, want] of Object.entries(expected)) {
    const got = byName.get(name) ?? 0;
    if (got !== want) {
      console.error(`Stock mismatch for ${name} (${label}): got ${got}, want ${want}`);
      process.exit(1);
    }
  }

  console.log("Net totals confirmed", label + ".");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
