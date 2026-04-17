# Put the app online (simple checklist)

You only need **three things**: GitHub (you have it), **Vercel** (free hosting), and your **Supabase database string**.

## Do this in order

1. **Go to [vercel.com](https://vercel.com)** and sign in with GitHub.

2. **Add new project** → pick your **`BarebackInventory`** repo → **Import**.

3. **Before you click Deploy**, open **Environment Variables** on that same screen:
   - **Name:** `DATABASE_URL`
   - **Value (important):** In Supabase, click **Connect** (top of the dashboard) or **Project Settings → Database**.  
     **Do not use “Direct connection”** (`db.….supabase.co:5432`) for Vercel — it often fails with “Can’t reach database” because Vercel uses IPv4 and the direct host is IPv6-only.
     Instead choose **“Session pooler”** (or **“Transaction pooler”**) and copy that **URI**. Paste your database password, then **Copy** the full line into Vercel.
   - Turn on **Production** and **Preview** (so builds don’t fail).

4. Click **Deploy** and wait a few minutes.

5. Open the **`.vercel.app` link** Vercel gives you — that’s your live app.

## If the build fails

**A)** In Vercel: **Settings → General → Build & Development Settings → Build Command**  
Set it to **`npm run build`**  
—or turn **Override** **off** so it uses the project’s default.

**B)** Make sure **`DATABASE_URL`** is really saved (same screen as step 3) for **Production**.

**C)** Redeploy: **Deployments** → **⋯** on the latest → **Redeploy**.

**D) Error `P1001` / “Can’t reach database server” at `db.….supabase.co:5432`**  
You’re on the **direct** URL. Replace `DATABASE_URL` in Vercel with the **Session pooler** string from Supabase **Connect** (see step 3), save, then **Redeploy**.

That’s it. No need to remember `prisma` commands — the app runs them when it builds, as long as `DATABASE_URL` is set.
