-- Phase 11 : mémoire des assistants (vendeur et administrateur).
-- À coller dans Supabase > SQL Editor puis « Run ». Une seule fois ; relançable sans danger.
-- Tant qu'il n'est pas lancé, les assistants fonctionnent mais n'enregistrent rien (pas de mémoire).

-- Conversation : lue et écrite seulement par le serveur (clé de service). Personne d'autre n'y a accès.
create table if not exists public.assistant_messages (
  id bigint generated always as identity primary key,
  shop_id uuid references public.shops(id) on delete cascade,        -- assistant de vente : la boutique
  admin_id uuid references auth.users(id) on delete cascade,         -- assistant administrateur : le compte
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 6000),
  created_at timestamptz not null default now(),
  check ((shop_id is not null) <> (admin_id is not null))
);
create index if not exists idx_assistant_messages_shop on public.assistant_messages(shop_id, id) where shop_id is not null;
create index if not exists idx_assistant_messages_admin on public.assistant_messages(admin_id, id) where admin_id is not null;
alter table public.assistant_messages enable row level security;
revoke all on public.assistant_messages from anon, authenticated;

-- Mémoire : résumé automatique des anciens échanges (un seul par boutique ou par administrateur).
create table if not exists public.assistant_memory (
  id bigint generated always as identity primary key,
  shop_id uuid unique references public.shops(id) on delete cascade,
  admin_id uuid unique references auth.users(id) on delete cascade,
  summary text not null default '' check (char_length(summary) <= 4000),
  summarized_through bigint not null default 0,                      -- dernier message déjà résumé
  updated_at timestamptz not null default now(),
  check ((shop_id is not null) <> (admin_id is not null))
);
alter table public.assistant_memory enable row level security;
revoke all on public.assistant_memory from anon, authenticated;
