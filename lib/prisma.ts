import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = globalForPrisma.pool ?? new Pool({ connectionString });
  globalForPrisma.pool = pool;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

/** After `prisma generate`, dev HMR can keep an old global client missing new delegates. */
function isStalePrismaClient(client: PrismaClient): boolean {
  const c = client as unknown as {
    receipt?: { findMany: unknown };
    packedStockMovement?: { findMany: unknown };
  };
  return (
    typeof c.receipt?.findMany !== "function" ||
    typeof c.packedStockMovement?.findMany !== "function"
  );
}

function getOrCreatePrisma(): PrismaClient {
  if (process.env.NODE_ENV !== "production") {
    const g = globalForPrisma;
    if (g.prisma && isStalePrismaClient(g.prisma)) {
      void g.prisma.$disconnect().catch(() => {});
      g.prisma = undefined;
      g.pool = undefined;
    }
  }
  return globalForPrisma.prisma ?? createPrismaClient();
}

export const prisma = getOrCreatePrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
