-- =====================================================================
-- WappShop - Phase 1 : base de données, sécurité (RLS) et stockage
-- A coller dans Supabase > SQL Editor puis cliquer sur "Run".
-- Peut être relancé sans danger (les anciennes règles sont remplacées).
-- =====================================================================

-- 0. Nettoyage des anciennes règles de sécurité -----------------------
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;
drop policy if exists "wappshop_storage_select_own" on storage.objects;
drop policy if exists "wappshop_storage_insert_own" on storage.objects;
drop policy if exists "wappshop_storage_update_own" on storage.objects;
drop policy if exists "wappshop_storage_delete_own" on storage.objects;

-- 1. Types ------------------------------------------------------------
do $$ begin create type public.order_status as enum ('new','confirmed','delivered');
exception when duplicate_object then null; end $$;
do $$ begin create type public.fulfillment_type as enum ('delivery','pickup');
exception when duplicate_object then null; end $$;
do $$ begin create type public.badge_type as enum ('none','new','promo');
exception when duplicate_object then null; end $$;
do $$ begin create type public.event_kind as enum ('visit','checkout');
exception when duplicate_object then null; end $$;

-- 2. Tables -----------------------------------------------------------
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  shop_name text not null check (char_length(trim(shop_name)) between 2 and 80),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and char_length(slug) between 3 and 40
      and slug <> all (array['dashboard','login','register','admin','api','app','www','auth','avis','produit','static','public','support'])),
  logo_url text,
  whatsapp_number text not null check (whatsapp_number ~ '^[0-9]{8,15}$'),
  delivery_enabled boolean not null default true,
  pickup_enabled boolean not null default true,
  pickup_address text,
  payment_methods text[] not null default '{}',
  payment_note text,
  about text,
  opening_hours text,
  social_url text check (social_url is null or social_url ~* '^https?://'),
  announcement text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_name text not null check (char_length(trim(category_name)) between 1 and 60),
  image_url text,
  created_at timestamptz not null default now(),
  unique (shop_id, category_name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  price numeric(12,2) not null check (price >= 0),
  badge public.badge_type not null default 'none',
  old_price numeric(12,2) check (old_price is null or old_price >= 0),
  sold_out boolean not null default false,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_name text not null check (char_length(trim(variant_name)) > 0),
  variant_value text not null check (char_length(trim(variant_value)) > 0),
  price_supplement numeric(12,2) not null default 0 check (price_supplement >= 0),
  position integer not null default 0
);

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  fee numeric(12,2) not null default 0 check (fee >= 0),
  position integer not null default 0
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_number bigint generated always as identity unique,
  items_details jsonb not null,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  status public.order_status not null default 'new',
  customer_name text,
  fulfillment public.fulfillment_type,
  delivery_zone text,
  delivery_address text,
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  payment_method text,
  review_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  type public.event_kind not null,
  session_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 300),
  created_at timestamptz not null default now()
);

-- Bases créées avant la phase 3 : ajout de l'ordre d'affichage
alter table public.variants add column if not exists position integer not null default 0;
alter table public.delivery_zones add column if not exists position integer not null default 0;

-- 3. Index ------------------------------------------------------------
create index if not exists idx_categories_shop on public.categories(shop_id);
create index if not exists idx_products_shop on public.products(shop_id);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_images_product on public.images(product_id, position);
create index if not exists idx_variants_product on public.variants(product_id);
create index if not exists idx_zones_shop on public.delivery_zones(shop_id);
create index if not exists idx_orders_shop on public.orders(shop_id, created_at desc);
create index if not exists idx_events_shop on public.events(shop_id, created_at desc);
create index if not exists idx_reviews_shop on public.reviews(shop_id);

-- 4. Fonctions d'aide et déclencheurs ----------------------------------
create or replace function public.is_shop_owner(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shops where id = p_shop and user_id = auth.uid())
$$;

create or replace function public.is_product_owner(p_product uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.products p join public.shops s on s.id = p.shop_id
                 where p.id = p_product and s.user_id = auth.uid())
$$;

revoke all on function public.is_shop_owner(uuid), public.is_product_owner(uuid) from public, anon;
grant execute on function public.is_shop_owner(uuid), public.is_product_owner(uuid) to authenticated;

-- Maximum 8 photos par produit
create or replace function public.limit_images() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.images where product_id = new.product_id) >= 8 then
    raise exception 'Maximum 8 photos par produit';
  end if;
  return new;
end $$;
drop trigger if exists trg_limit_images on public.images;
create trigger trg_limit_images before insert on public.images
  for each row execute function public.limit_images();

-- Un avis n'est possible que pour une commande livrée ; la boutique est déduite de la commande
create or replace function public.check_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select shop_id, status into o from public.orders where id = new.order_id;
  if not found or o.status <> 'delivered' then
    raise exception 'Avis possible seulement pour une commande livrée';
  end if;
  new.shop_id := o.shop_id;
  return new;
end $$;
drop trigger if exists trg_check_review on public.reviews;
create trigger trg_check_review before insert on public.reviews
  for each row execute function public.check_review();

-- 5. Sécurité : RLS ----------------------------------------------------
alter table public.shops enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.images enable row level security;
alter table public.variants enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;
alter table public.events enable row level security;
alter table public.reviews enable row level security;

-- Droits de base : on retire tout, puis on donne le strict nécessaire
alter default privileges in schema public revoke all on tables from anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;

-- Visiteurs (clients non connectés) : lecture du catalogue seulement
grant select on public.categories, public.products, public.images,
  public.variants, public.delivery_zones, public.reviews to anon;
grant select (id, shop_name, slug, logo_url, whatsapp_number, delivery_enabled, pickup_enabled,
  pickup_address, payment_methods, payment_note, about, opening_hours, social_url,
  announcement, created_at) on public.shops to anon;

-- Vendeurs connectés
grant select, insert, update, delete on public.shops, public.categories, public.products,
  public.images, public.variants, public.delivery_zones to authenticated;
grant select on public.orders, public.events, public.reviews to authenticated;
grant update (status) on public.orders to authenticated;   -- seul le statut est modifiable

-- Boutiques
create policy shops_public_read on public.shops for select to anon, authenticated using (true);
create policy shops_insert_own on public.shops for insert to authenticated with check (user_id = auth.uid());
create policy shops_update_own on public.shops for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy shops_delete_own on public.shops for delete to authenticated using (user_id = auth.uid());

-- Catalogue : lecture publique, écriture réservée au propriétaire de la boutique
create policy categories_public_read on public.categories for select to anon, authenticated using (true);
create policy categories_owner_write on public.categories for all to authenticated
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

create policy products_public_read on public.products for select to anon, authenticated using (true);
create policy products_owner_write on public.products for all to authenticated
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id)
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and c.shop_id = products.shop_id)));

create policy images_public_read on public.images for select to anon, authenticated using (true);
create policy images_owner_write on public.images for all to authenticated
  using (public.is_product_owner(product_id)) with check (public.is_product_owner(product_id));

create policy variants_public_read on public.variants for select to anon, authenticated using (true);
create policy variants_owner_write on public.variants for all to authenticated
  using (public.is_product_owner(product_id)) with check (public.is_product_owner(product_id));

create policy zones_public_read on public.delivery_zones for select to anon, authenticated using (true);
create policy zones_owner_write on public.delivery_zones for all to authenticated
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

-- Commandes : jamais visibles du public ; création uniquement par le serveur (clé de service)
create policy orders_owner_read on public.orders for select to authenticated using (public.is_shop_owner(shop_id));
create policy orders_owner_update on public.orders for update to authenticated
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

-- Statistiques : lecture par le propriétaire ; écriture uniquement par le serveur
create policy events_owner_read on public.events for select to authenticated using (public.is_shop_owner(shop_id));

-- Avis : lecture publique ; création uniquement par le serveur (jeton d'avis)
create policy reviews_public_read on public.reviews for select to anon, authenticated using (true);

-- 6. Stockage des images ----------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('logos', 'logos', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Chaque vendeur écrit uniquement dans son dossier : {id_du_vendeur}/...
create policy "wappshop_storage_select_own" on storage.objects for select to authenticated
  using (bucket_id in ('logos','product-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wappshop_storage_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id in ('logos','product-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wappshop_storage_update_own" on storage.objects for update to authenticated
  using (bucket_id in ('logos','product-images') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('logos','product-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wappshop_storage_delete_own" on storage.objects for delete to authenticated
  using (bucket_id in ('logos','product-images') and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- VERIFICATIONS (à lancer séparément après le script, sans le --)
-- 1) Toutes les tables doivent afficher rowsecurity = true :
--    select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
-- 2) Les 2 buckets doivent exister :
--    select id, public, file_size_limit from storage.buckets;
-- 3) Les règles doivent être listées :
--    select tablename, policyname from pg_policies where schemaname = 'public' order by 1, 2;
-- =====================================================================