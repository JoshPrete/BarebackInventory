/** Quick verification output for 1kg seed — run: npx tsx scripts/verify-1kg-seed.ts */
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

const CODES = [
  "ORIGINAL-1KG",
  "SMOKE-1KG",
  "CHIMICHURRI-1KG",
  "SMOKE-CHILLI-1KG",
  "SALT-VINEGAR-1KG",
] as const;

async function main() {
  const { prisma } = await import("../lib/prisma");

  const skus = await prisma.sellableSKU.findMany({
    where: { sku: { in: [...CODES] } },
    orderBy: { sku: "asc" },
  });

  const rules = await prisma.sKUComponentRule.findMany({
    where: { sku: { sku: { in: [...CODES] } } },
    include: { sku: { select: { sku: true, name: true } }, component: true },
  });
  rules.sort((a, b) => {
    const sc = a.sku.sku.localeCompare(b.sku.sku);
    if (sc !== 0) return sc;
    return a.component.name.localeCompare(b.component.name);
  });

  console.log("--- SKUs ---");
  for (const c of CODES) {
    const row = skus.find((s) => s.sku === c);
    console.log(row ? `  ${row.sku}  (${row.name})` : `  MISSING: ${c}`);
  }

  console.log("\n--- Rules (sku, component, qtyPerUnit) ---");
  for (const c of CODES) {
    const subset = rules.filter((r) => r.sku.sku === c);
    console.log(`\n${c}:`);
    for (const r of subset) {
      console.log(`  ${r.component.name}\t${r.qtyPerUnit}`);
    }
    if (subset.length !== 3) {
      console.log(`  [WARN] expected 3 rules, got ${subset.length}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
