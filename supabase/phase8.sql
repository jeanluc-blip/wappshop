-- =====================================================================
-- WappShop - Phase 8 : partage, sources de visite, produits en vedette, téléphone client.
-- A coller dans Supabase > SQL Editor puis "Run". Peut être relancé sans danger.
-- (Le site continue de fonctionner même si ce script n'est pas encore lancé :
--  les nouvelles fonctions restent simplement inactives jusque-là.)
-- =====================================================================

-- Produits en vedette (affichés en premier dans la boutique)
alter table public.products add column if not exists featured boolean not null default false;

-- Numéro WhatsApp du client (facultatif), pour que le vendeur puisse le recontacter
alter table public.orders add column if not exists customer_phone text
  check (customer_phone is null or char_length(customer_phone) <= 30);

-- Statistiques : d'où viennent les visiteurs, et quels produits sont consultés / ajoutés au panier
alter table public.events add column if not exists source text
  check (source is null or char_length(source) <= 30);
alter table public.events add column if not exists product_id uuid
  references public.products(id) on delete set null;
alter type public.event_kind add value if not exists 'product_view';
alter type public.event_kind add value if not exists 'add_to_cart';

create index if not exists idx_events_shop_type_created on public.events(shop_id, type, created_at);
