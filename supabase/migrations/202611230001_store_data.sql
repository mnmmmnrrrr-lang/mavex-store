-- Run this once in the Supabase SQL Editor for the MAVEX project.
-- Private shop data is intentionally accessible only through the protected Next.js server.

create table if not exists public.mavex_catalog (
  product_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  is_deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.mavex_orders (
  id text primary key,
  data jsonb not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mavex_returns (
  id text primary key,
  data jsonb not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mavex_product_comments (
  id text primary key,
  data jsonb not null,
  status text not null check (status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists mavex_orders_created_at_idx on public.mavex_orders (created_at desc);
create index if not exists mavex_returns_created_at_idx on public.mavex_returns (created_at desc);
create index if not exists mavex_comments_created_at_idx on public.mavex_product_comments (created_at desc);
create index if not exists mavex_comments_status_idx on public.mavex_product_comments (status);

alter table public.mavex_catalog enable row level security;
alter table public.mavex_orders enable row level security;
alter table public.mavex_returns enable row level security;
alter table public.mavex_product_comments enable row level security;

revoke all on public.mavex_catalog, public.mavex_orders, public.mavex_returns, public.mavex_product_comments from anon, authenticated;
grant select, insert, update, delete on public.mavex_catalog, public.mavex_orders, public.mavex_returns, public.mavex_product_comments to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('mavex-product-images', 'mavex-product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('mavex-payment-proofs', 'mavex-payment-proofs', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
