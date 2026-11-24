-- Run once in the Supabase SQL Editor to enable public product video uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mavex-product-videos',
  'mavex-product-videos',
  true,
  31457280,
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
