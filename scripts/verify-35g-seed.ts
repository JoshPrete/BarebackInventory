/** Verify 35g SKUs and rules — run: npx tsx scripts/verify-35g-seed.ts */
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
  "ORIGINAL-35G",
  "SMOKE-35G",
  "CHIMICHURRI-35G",
  "SMOKE-CHILLI-35G",
  "SALT-VINEGAR-35G",
] as const;

const EXPECTED_QTY = new Map<string, number>([
  ["bulk", 35],
  ["pouch", 1],
  ["absorber", 1],
  ["box", 0.1],
]);

function classify(name: string): "bulk" | "pouch" | "box" | "absorber" | "other" {
  if (name === "absorber") return "absorber";
  if (name.endsWith("dried biltong")) return "bulk";
  if (name.includes("35g pouch")) return "pouch";
  if (name.endsWith("box")) return "box";
  return "other";
}

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
    console.log(row ? `  OK ${row.sku}  (${row.name})` : `  MISSING: ${c}`);
  }

  console.log("\n--- Rules ---");
  let issues = 0;
  for (const c of CODES) {
    const subset = rules.filter((r) => r.sku.sku === c);
    console.log(`\n${c} (${subset.length} rules):`);
    for (const r of subset) {
      const kind = classify(r.component.name);
      const exp =
        kind === "other" ? undefined : EXPECTED_QTY.get(kind);
      const ok = exp !== undefined && Math.abs(r.qtyPerUnit - exp) < 1e-9;
      if (!ok) issues += 1;
      console.log(
        `  ${r.component.name}\tqty=${r.qtyPerUnit}${exp !== undefined ? `\texpected ${exp}` : ""}${ok ? "\tOK" : "\tMISMATCH"}`,
      );
    }
    if (subset.length !== 4) {
      console.log(`  [WARN] expected 4 rules, got ${subset.length}`);
      issues += 1;
    }
  }

  const legacy = await prisma.component.findMany({
    where: {
      name: { in: ["35g pouch", "Original label"] },
    },
    select: { name: true },
  });
  if (legacy.length > 0) {
    console.log(
      "\n--- Legacy components still in DB (harmless; not mapped to 35g SKUs) ---",
    );
    for (const x of legacy) console.log(`  ${x.name}`);
  }

  await prisma.$disconnect();
  process.exit(issues > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
