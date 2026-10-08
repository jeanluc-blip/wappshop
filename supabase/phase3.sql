-- =====================================================================
-- WappShop - Phase 3 : ordre stable des variantes et des zones de livraison.
-- A coller dans Supabase > SQL Editor puis "Run". Peut être relancé sans danger.
-- (Déjà inclus dans schema.sql pour une nouvelle base.)
-- =====================================================================
alter table public.variants add column if not exists position integer not null default 0;
alter table public.delivery_zones add column if not exists position integer not null default 0;
