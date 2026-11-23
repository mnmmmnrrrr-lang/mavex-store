# MAVEX Store

## Run locally

1. Copy `.env.example` to `.env.local` and fill in the Supabase project URL, publishable key, server-only secret key, and admin password.
2. In the Supabase SQL Editor, run [`supabase/migrations/202611230001_store_data.sql`](supabase/migrations/202611230001_store_data.sql).
3. Run `npm run dev` and open `http://localhost:3000`.

## Deploy online

Import this GitHub repository into Vercel. Add the same four environment variables under **Project Settings → Environment Variables** for Production and Preview, then deploy. Later GitHub pushes trigger deployments.

`SUPABASE_SECRET_KEY` and `MAVEX_ADMIN_PASSWORD` are private server variables. Never prefix them with `NEXT_PUBLIC_` or commit `.env.local`. The browser must use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; never put a secret key in any `NEXT_PUBLIC_` variable. Shop data tables are private to the server API. Product images are stored in a public bucket; payment screenshots are private and accessed through short-lived signed links.
