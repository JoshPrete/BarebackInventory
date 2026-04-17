/**
 * Vercel / CI build: requires DATABASE_URL so prisma migrate deploy can run.
 * @see https://vercel.com/docs/projects/environment-variables
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

console.log("[build] prisma migrate deploy");
execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });

console.log("[build] next build");
execSync("npx next build", { stdio: "inherit", env: process.env });
