# MAVEX Store

## Run locally

1. Copy `.env.example` to `.env.local` and fill in the Supabase project URL, publishable key, server-only secret key, admin password, and notification settings.
2. In the Supabase SQL Editor, run [`supabase/migrations/202611230001_store_data.sql`](supabase/migrations/202611230001_store_data.sql).
3. Run `npm run dev` and open `http://localhost:3000`.

## Deploy online

Import this GitHub repository into Vercel. Add the environment variables under **Project Settings → Environment Variables** for Production and Preview, then deploy. Later GitHub pushes trigger deployments.

`SUPABASE_SECRET_KEY`, `MAVEX_ADMIN_PASSWORD`, and `TELEGRAM_BOT_TOKEN` are private server variables. Never prefix them with `NEXT_PUBLIC_` or commit `.env.local`. The browser must use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; never put a secret key in any `NEXT_PUBLIC_` variable. Shop data tables are private to the server API. Product images are stored in a public bucket; payment screenshots are private and accessed through short-lived signed links.

Order email notifications use Resend. Set `RESEND_API_KEY`, `MAVEX_ADMIN_EMAIL`, and `MAVEX_EMAIL_FROM` to receive an email when a customer submits an order. Verify the sender domain in Resend before using a custom `MAVEX_EMAIL_FROM` address. The customer email is saved with their order and shown to the admin.

Customer account access uses Google OAuth. Configure the Google provider under **Supabase → Authentication → Sign In / Providers → Google**, then add the deployed and local `/auth/callback` URLs to the Supabase redirect allow list. Google OAuth returns to the account page, which uses the Google account's verified email to find orders.

To receive Telegram order alerts, set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env.local` or **Vercel → Project Settings → Environment Variables** for the environments you deploy. Start a chat with your bot before using it. The notification is sent after the order response, so Telegram delays do not delay checkout confirmation. Redeploy after adding or changing the Vercel variables.
