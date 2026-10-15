import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Données de l'espace administrateur : lues avec la clé serveur, uniquement après vérification de l'administrateur par la page.

export type SellerSummary = {
  shopId: string;
  shopName: string;
  slug: string;
  whatsapp: string;
  userId: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  products: number;
  orders: number;
  delivered: number;
  revenueDelivered: number;
  lastOrderAt: string | null;
  /** Messages du vendeur que l'administrateur n'a pas encore lus. */
  unreadFromSeller: number;
  lastMessageAt: string | null;
};

export type AdminData = { sellers: SellerSummary[]; messagingReady: boolean };

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

async function listUsers(admin: AdminClient): Promise<Map<string, { email: string | null; lastSignInAt: string | null }>> {
  const users = new Map<string, { email: string | null; lastSignInAt: string | null }>();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const user of data.users) users.set(user.id, { email: user.email ?? null, lastSignInAt: user.last_sign_in_at ?? null });
    if (data.users.length < 1000) break;
  }
  return users;
}

export async function loadSellers(): Promise<AdminData | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const [shops, products, orders, messages, users] = await Promise.all([
    admin.from("shops").select("id, shop_name, slug, whatsapp_number, user_id, created_at").order("created_at", { ascending: false }).limit(5000),
    admin.from("products").select("shop_id").limit(50000),
    admin.from("orders").select("shop_id, status, total_amount, created_at").order("created_at", { ascending: false }).limit(50000),
    admin.from("messages").select("shop_id, sender, read_at, created_at").order("created_at", { ascending: false }).limit(50000),
    listUsers(admin),
  ]);
  if (shops.error) throw new Error(`Lecture des vendeurs impossible : ${shops.error.message}`);

  const productCount = new Map<string, number>();
  for (const row of products.data ?? []) productCount.set(row.shop_id as string, (productCount.get(row.shop_id as string) ?? 0) + 1);

  const orderStats = new Map<string, { orders: number; delivered: number; revenue: number; last: string | null }>();
  for (const row of orders.data ?? []) {
    const id = row.shop_id as string;
    const entry = orderStats.get(id) ?? { orders: 0, delivered: 0, revenue: 0, last: null };
    entry.orders += 1;
    if (row.status === "delivered") {
      entry.delivered += 1;
      entry.revenue += Number(row.total_amount);
    }
    if (!entry.last) entry.last = row.created_at as string; // lignes triées de la plus récente à la plus ancienne
    orderStats.set(id, entry);
  }

  // Si la table « messages » n'existe pas encore (phase9.sql non lancé), la messagerie est simplement marquée indisponible.
  const messagingReady = !messages.error;
  const messageStats = new Map<string, { unread: number; last: string | null }>();
  for (const row of messages.data ?? []) {
    const id = row.shop_id as string;
    const entry = messageStats.get(id) ?? { unread: 0, last: null };
    if (row.sender === "seller" && !row.read_at) entry.unread += 1;
    if (!entry.last) entry.last = row.created_at as string;
    messageStats.set(id, entry);
  }

  const sellers: SellerSummary[] = (shops.data ?? []).map((shop) => {
    const id = shop.id as string;
    const stats = orderStats.get(id);
    const msg = messageStats.get(id);
    const user = users.get(shop.user_id as string);
    return {
      shopId: id,
      shopName: shop.shop_name as string,
      slug: shop.slug as string,
      whatsapp: shop.whatsapp_number as string,
      userId: shop.user_id as string,
      email: user?.email ?? null,
      createdAt: shop.created_at as string,
      lastSignInAt: user?.lastSignInAt ?? null,
      products: productCount.get(id) ?? 0,
      orders: stats?.orders ?? 0,
      delivered: stats?.delivered ?? 0,
      revenueDelivered: stats?.revenue ?? 0,
      lastOrderAt: stats?.last ?? null,
      unreadFromSeller: msg?.unread ?? 0,
      lastMessageAt: msg?.last ?? null,
    };
  });
  return { sellers, messagingReady };
}

export type ChatMessage = { id: string; sender: "seller" | "admin"; kind: "chat" | "announcement"; body: string; createdAt: string };
