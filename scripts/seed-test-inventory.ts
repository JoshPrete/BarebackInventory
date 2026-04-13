/**
 * Legacy helper: loads shared components used in early demos.
 * For full 35g / 1kg flavour SKUs and mappings, run:
 *   npm run seed:35g
 *   npm run seed:1kg
 *
 * Run from project root: npm run seed:test
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

async function ensureComponent(
  prisma: PrismaClient,
  name: string,
  type: "BILTONG_BULK" | "PACKAGING",
  unit: string,
  reorderPoint: number,
  reorderQty: number,
) {
  const existing = await prisma.component.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.component.create({
    data: { name, type, unit, reorderPoint, reorderQty },
  });
}

async function main() {
  const { prisma } = await import("../lib/prisma");

  await ensureComponent(
    prisma,
    "Original dried biltong",
    "BILTONG_BULK",
    "g",
    1000,
    5000,
  );
  await ensureComponent(prisma, "absorber", "PACKAGING", "ea", 0, 500);
  await ensureComponent(prisma, "1kg pouch", "PACKAGING", "ea", 0, 50);

  await prisma.$disconnect();
  console.log("Seed complete (shared components only). Use seed:35g / seed:1kg for flavour SKUs.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
