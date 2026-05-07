/**
 * Vercel / CI build: requires DATABASE_URL so prisma migrate deploy can run.
 * @see https://vercel.com/docs/projects/environment-variables
 *
 * DIRECT_URL (optional): non-pooler Neon connection string.
 * Neon's pooler runs in transaction mode and does not support the session-level
 * advisory locks that prisma migrate deploy requires. When DIRECT_URL is set,
 * migrate runs against the direct endpoint; next build uses DATABASE_URL (pooler).
 */
const { execSync } = require("node:child_process");

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(`
[build] DATABASE_URL is not set for this build.

In Vercel: open your project → Settings → Environment Variables → add:

  DATABASE_URL = <your Postgres connection string>

Enable it for "Production" (and "Preview" if you use preview deployments).

Save, then trigger a new deployment (Redeploy).

`);
  process.exit(1);
}

// Use DIRECT_URL for migrate if available — bypasses pooler advisory lock issue.
const directUrl = process.env.DIRECT_URL?.trim();
const migrateEnv = directUrl
  ? { ...process.env, DATABASE_URL: directUrl }
  : process.env;

if (directUrl) {
  console.log("[build] prisma migrate deploy (using DIRECT_URL to bypass pooler)");
} else {
  console.log("[build] prisma migrate deploy");
}
execSync("npx prisma migrate deploy", { stdio: "inherit", env: migrateEnv });

console.log("[build] next build");
execSync("npx next build", { stdio: "inherit", env: process.env });
