-- Run once in the MAVEX Supabase SQL Editor before using the collection manager.
-- Existing products remain in mavex_catalog / products and are not rewritten.
create table if not exists public.mavex_storefront_settings (
  id text primary key check (id = 'main'),
  data jsonb not null default '{"collections": []}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mavex_storefront_settings enable row level security;
revoke all on public.mavex_storefront_settings from anon, authenticated;
grant select, insert, update, delete on public.mavex_storefront_settings to service_role;
