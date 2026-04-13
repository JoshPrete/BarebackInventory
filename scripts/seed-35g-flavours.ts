/**
 * Seed 35g flavour-specific components, sellable SKUs, and SKUComponentRule rows.
 * Matches 1kg flavour coverage. Idempotent: re-run safe. Replaces all rules for the five 35g SKU codes each run.
 *
 * Run: npx tsx scripts/seed-35g-flavours.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "../app/generated/prisma/client";

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

const BULK_COMPONENTS: { name: string; reorderPoint: number; reorderQty: number }[] = [
  { name: "Original dried biltong", reorderPoint: 1000, reorderQty: 5000 },
  { name: "Smoke dried biltong", reorderPoint: 1000, reorderQty: 5000 },
  { name: "Chimichurri dried biltong", reorderPoint: 1000, reorderQty: 5000 },
  { name: "Smoke Chilli dried biltong", reorderPoint: 1000, reorderQty: 5000 },
  { name: "Salt & Vinegar dried biltong", reorderPoint: 1000, reorderQty: 5000 },
];

const POUCH_35G: { name: string; reorderPoint: number; reorderQty: number }[] = [
  { name: "Original 35g pouch", reorderPoint: 0, reorderQty: 100 },
  { name: "Smoke 35g pouch", reorderPoint: 0, reorderQty: 100 },
  { name: "Chimichurri 35g pouch", reorderPoint: 0, reorderQty: 100 },
  { name: "Smoke Chilli 35g pouch", reorderPoint: 0, reorderQty: 100 },
  { name: "Salt & Vinegar 35g pouch", reorderPoint: 0, reorderQty: 100 },
];

const BOX_35G: { name: string; reorderPoint: number; reorderQty: number }[] = [
  { name: "Original box", reorderPoint: 0, reorderQty: 100 },
  { name: "Smoke box", reorderPoint: 0, reorderQty: 100 },
  { name: "Chimichurri box", reorderPoint: 0, reorderQty: 100 },
  { name: "Smoke Chilli box", reorderPoint: 0, reorderQty: 100 },
  { name: "Salt & Vinegar box", reorderPoint: 0, reorderQty: 100 },
];

const ABSORBER = {
  name: "absorber",
  reorderPoint: 0,
  reorderQty: 500,
} as const;

const THIRTY_FIVE_G_SKUS: {
  sku: string;
  displayName: string;
  bulkComponentName: string;
  pouchComponentName: string;
  boxComponentName: string;
}[] = [
  {
    sku: "ORIGINAL-35G",
    displayName: "Original 35g",
    bulkComponentName: "Original dried biltong",
    pouchComponentName: "Original 35g pouch",
    boxComponentName: "Original box",
  },
  {
    sku: "SMOKE-35G",
    displayName: "Smoke 35g",
    bulkComponentName: "Smoke dried biltong",
    pouchComponentName: "Smoke 35g pouch",
    boxComponentName: "Smoke box",
  },
  {
    sku: "CHIMICHURRI-35G",
    displayName: "Chimichurri 35g",
    bulkComponentName: "Chimichurri dried biltong",
    pouchComponentName: "Chimichurri 35g pouch",
    boxComponentName: "Chimichurri box",
  },
  {
    sku: "SMOKE-CHILLI-35G",
    displayName: "Smoke Chilli 35g",
    bulkComponentName: "Smoke Chilli dried biltong",
    pouchComponentName: "Smoke Chilli 35g pouch",
    boxComponentName: "Smoke Chilli box",
  },
  {
    sku: "SALT-VINEGAR-35G",
    displayName: "Salt & Vinegar 35g",
    bulkComponentName: "Salt & Vinegar dried biltong",
    pouchComponentName: "Salt & Vinegar 35g pouch",
    boxComponentName: "Salt & Vinegar box",
  },
];

async function ensureComponent(
  prisma: PrismaClient,
  name: string,
  type: "BILTONG_BULK" | "PACKAGING",
  unit: string,
  reorderPoint: number,
  reorderQty: number,
) {
  const existing = await prisma.component.findFirst({ where: { name } });
  if (existing) return { row: existing, created: false };
  const row = await prisma.component.create({
    data: { name, type, unit, reorderPoint, reorderQty },
  });
  return { row, created: true };
}

async function ensureSku(
  prisma: PrismaClient,
  name: string,
  sku: string,
  isBundle: boolean,
) {
  const existing = await prisma.sellableSKU.findUnique({ where: { sku } });
  if (existing) {
    if (existing.name !== name) {
      await prisma.sellableSKU.update({ where: { sku }, data: { name } });
    }
    const row = await prisma.sellableSKU.findUniqueOrThrow({ where: { sku } });
    return { row, created: false };
  }
  const row = await prisma.sellableSKU.create({
    data: { name, sku, isBundle },
  });
  return { row, created: true };
}

async function main() {
  const { prisma } = await import("../lib/prisma");

  const stats = {
    componentsCreated: 0,
    skusCreated: 0,
    rulesCreated: 0,
  };

  for (const c of BULK_COMPONENTS) {
    const { created } = await ensureComponent(
      prisma,
      c.name,
      "BILTONG_BULK",
      "g",
      c.reorderPoint,
      c.reorderQty,
    );
    if (created) stats.componentsCreated += 1;
  }

  for (const c of POUCH_35G) {
    const { created } = await ensureComponent(
      prisma,
      c.name,
      "PACKAGING",
      "ea",
      c.reorderPoint,
      c.reorderQty,
    );
    if (created) stats.componentsCreated += 1;
  }

  for (const c of BOX_35G) {
    const { created } = await ensureComponent(
      prisma,
      c.name,
      "PACKAGING",
      "ea",
      c.reorderPoint,
      c.reorderQty,
    );
    if (created) stats.componentsCreated += 1;
  }

  {
    const { created } = await ensureComponent(
      prisma,
      ABSORBER.name,
      "PACKAGING",
      "ea",
      ABSORBER.reorderPoint,
      ABSORBER.reorderQty,
    );
    if (created) stats.componentsCreated += 1;
  }

  for (const def of THIRTY_FIVE_G_SKUS) {
    const { created } = await ensureSku(prisma, def.displayName, def.sku, false);
    if (created) stats.skusCreated += 1;
  }

  const skuIds = (
    await prisma.sellableSKU.findMany({
      where: { sku: { in: THIRTY_FIVE_G_SKUS.map((s) => s.sku) } },
      select: { id: true },
    })
  ).map((s) => s.id);

  const deleted = await prisma.sKUComponentRule.deleteMany({
    where: { skuId: { in: skuIds } },
  });

  const absorber = await prisma.component.findFirstOrThrow({
    where: { name: ABSORBER.name },
  });

  for (const def of THIRTY_FIVE_G_SKUS) {
    const skuRow = await prisma.sellableSKU.findUniqueOrThrow({
      where: { sku: def.sku },
    });
    const bulk = await prisma.component.findFirstOrThrow({
      where: { name: def.bulkComponentName },
    });
    const pouch = await prisma.component.findFirstOrThrow({
      where: { name: def.pouchComponentName },
    });
    const box = await prisma.component.findFirstOrThrow({
      where: { name: def.boxComponentName },
    });

    await prisma.sKUComponentRule.createMany({
      data: [
        { skuId: skuRow.id, componentId: bulk.id, qtyPerUnit: 35 },
        { skuId: skuRow.id, componentId: pouch.id, qtyPerUnit: 1 },
        { skuId: skuRow.id, componentId: absorber.id, qtyPerUnit: 1 },
        { skuId: skuRow.id, componentId: box.id, qtyPerUnit: 0.1 },
      ],
    });
    stats.rulesCreated += 4;
  }

  await prisma.$disconnect();

  console.log(
    JSON.stringify(
      {
        ok: true,
        componentsCreated: stats.componentsCreated,
        skusCreated: stats.skusCreated,
        rulesCreated: stats.rulesCreated,
        previousRulesRemoved: deleted.count,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
