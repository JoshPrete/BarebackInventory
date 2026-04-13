/**
 * Remove legacy components "35g pouch" and "Original label" from the active model:
 * deletes SKUComponentRule and StockMovement rows for those components, then deletes
 * the Component rows. Re-applies 35g flavour mappings via seed-35g-flavours.ts.
 *
 * Run: npx tsx scripts/remove-legacy-35g-components.ts
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LEGACY_NAMES = ["35g pouch", "Original label"] as const;

const THIRTY_FIVE_G_CODES = [
  "ORIGINAL-35G",
  "SMOKE-35G",
  "CHIMICHURRI-35G",
  "SMOKE-CHILLI-35G",
  "SALT-VINEGAR-35G",
] as const;

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

async function main() {
  const { prisma } = await import("../lib/prisma");

  const legacy = await prisma.component.findMany({
    where: { name: { in: [...LEGACY_NAMES] } },
    select: { id: true, name: true },
  });
  const legacyIds = legacy.map((c) => c.id);

  const rulesRemoved = await prisma.sKUComponentRule.deleteMany({
    where: { componentId: { in: legacyIds } },
  });

  const movementsRemoved = await prisma.stockMovement.deleteMany({
    where: { componentId: { in: legacyIds } },
  });

  const componentsDeleted = await prisma.component.deleteMany({
    where: { id: { in: legacyIds } },
  });

  execSync("npx tsx scripts/seed-35g-flavours.ts", {
    cwd: resolve(process.cwd()),
    stdio: "inherit",
    env: process.env,
  });

  const refsRemaining = await prisma.sKUComponentRule.count({
    where: { component: { name: { in: [...LEGACY_NAMES] } } },
  });
  const compsRemaining = await prisma.component.count({
    where: { name: { in: [...LEGACY_NAMES] } },
  });

  const perSku = await prisma.sellableSKU.findMany({
    where: { sku: { in: [...THIRTY_FIVE_G_CODES] } },
    select: {
      sku: true,
      _count: { select: { skuComponentRules: true } },
    },
    orderBy: { sku: "asc" },
  });

  await prisma.$disconnect();

  const report = {
    ok: true,
    legacyComponentsFound: legacy.map((c) => c.name),
    legacyMappingRulesRemoved: rulesRemoved.count,
    legacyStockMovementsRemoved: movementsRemoved.count,
    legacyComponentRecordsDeleted: componentsDeleted.count,
    referencesToLegacyNamesAfterCleanup: {
      skuComponentRules: refsRemaining,
      components: compsRemaining,
    },
    rulesPer35gSku: Object.fromEntries(
      perSku.map((s) => [s.sku, s._count.skuComponentRules]),
    ),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
