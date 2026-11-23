# MAVEX Store

## Run locally

1. Copy `.env.example` to `.env.local` and fill in the Supabase project URL, publishable key, server-only secret key, admin password, and email settings.
2. In the Supabase SQL Editor, run [`supabase/migrations/202611230001_store_data.sql`](supabase/migrations/202611230001_store_data.sql).
3. Run `npm run dev` and open `http://localhost:3000`.

## Deploy online

Import this GitHub repository into Vercel. Add the environment variables under **Project Settings → Environment Variables** for Production and Preview, then deploy. Later GitHub pushes trigger deployments.

`SUPABASE_SECRET_KEY` and `MAVEX_ADMIN_PASSWORD` are private server variables. Never prefix them with `NEXT_PUBLIC_` or commit `.env.local`. The browser must use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; never put a secret key in any `NEXT_PUBLIC_` variable. Shop data tables are private to the server API. Product images are stored in a public bucket; payment screenshots are private and accessed through short-lived signed links.

Order email notifications use Resend. Set `RESEND_API_KEY`, `MAVEX_ADMIN_EMAIL`, and `MAVEX_EMAIL_FROM` to receive an email when a customer submits an order. Verify the sender domain in Resend before using a custom `MAVEX_EMAIL_FROM` address. The customer email is saved with their order and shown to the admin; customers can return to `/account` and use that same verified email to see saved orders and tracking updates.

Customer order lookup now signs in with an email one-time code. For customer sign-ins outside the Supabase project team, configure custom SMTP under **Supabase → Authentication → Emails → SMTP Settings**. Supabase's built-in email service is limited to team addresses and low-volume testing. Set the email OTP template to include `{{ .Token }}` so customers receive a code they can enter.
