-- =====================================================================
-- WappShop - Phase 8 : bannière de la boutique et produits populaires.
-- A coller dans Supabase > SQL Editor puis "Run". Peut être relancé sans danger.
-- (Déjà inclus dans schema.sql pour une nouvelle base.)
-- =====================================================================
alter table public.shops add column if not exists banner_url text;
alter table public.shops add column if not exists banner_title text
  check (banner_title is null or char_length(banner_title) <= 80);
alter table public.products add column if not exists featured boolean not null default false;

-- Les visiteurs doivent pouvoir lire la bannière (accès limité à une liste de colonnes publiques).
grant select (banner_url, banner_title) on public.shops to anon;
