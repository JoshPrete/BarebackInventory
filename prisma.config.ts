import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DATABASE_URL  — pooler endpoint, used by the app at runtime
    // DIRECT_URL    — non-pooler endpoint, used by prisma migrate at build time
    // Neon pooler runs in transaction mode and does not support the session-level
    // advisory locks that prisma migrate deploy requires. directUrl bypasses
    // the pooler for migrations only.
    url: env("DATABASE_URL"),
    directUrl: env("DIRECT_URL"),
  },
});
