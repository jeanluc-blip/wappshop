-- =====================================================================
-- WappShop - Phase 9 (espace administrateur + messagerie) et phase 10 (assistant de vente).
-- A coller dans Supabase > SQL Editor puis "Run". Peut être relancé sans danger.
-- =====================================================================

-- ---------- Messagerie entre l'équipe WappShop et chaque vendeur (une conversation par boutique) ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  sender text not null check (sender in ('seller', 'admin')),
  kind text not null default 'chat' check (kind in ('chat', 'announcement')),
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_shop_created on public.messages(shop_id, created_at);
create index if not exists idx_messages_unread on public.messages(shop_id, sender) where read_at is null;

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;   -- le vendeur ne peut que marquer « lu »

-- Le vendeur lit uniquement les messages de SA boutique et n'écrit que des messages « vendeur ».
drop policy if exists messages_owner_read on public.messages;
create policy messages_owner_read on public.messages for select to authenticated
  using (public.is_shop_owner(shop_id));
drop policy if exists messages_owner_insert on public.messages;
create policy messages_owner_insert on public.messages for insert to authenticated
  with check (public.is_shop_owner(shop_id) and sender = 'seller' and kind = 'chat' and read_at is null);
drop policy if exists messages_owner_mark_read on public.messages;
create policy messages_owner_mark_read on public.messages for update to authenticated
  using (public.is_shop_owner(shop_id) and sender = 'admin')
  with check (public.is_shop_owner(shop_id) and sender = 'admin');

-- ---------- Assistant de vente : compteur de messages par jour (limite le coût), lu et écrit seulement par le serveur ----------
create table if not exists public.assistant_usage (
  shop_id uuid not null references public.shops(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (shop_id, day)
);
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_usage from anon, authenticated;
