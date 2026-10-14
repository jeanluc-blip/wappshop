import "server-only";
import { DEMO_WHATSAPP } from "@/lib/validators";
import type { MyShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";

// Contexte transmis à l'assistant : uniquement des CHIFFRES sur la boutique du vendeur connecté et les noms de ses produits
// (déjà publics). Jamais de nom, de téléphone ni d'adresse de client.

type Server = Awaited<ReturnType<typeof createClient>>;

export async function buildSellerContext(supabase: Server, shop: MyShop): Promise<string> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [products, categories, zones, orders, visits, reviews, productEvents] = await Promise.all([
    supabase.from("products").select("id, name, price, old_price, badge, sold_out, description, images(id)").eq("shop_id", shop.id).limit(500),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("delivery_zones").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("orders").select("status, total_amount").eq("shop_id", shop.id).gte("created_at", since).limit(5000),
    supabase.from("events").select("session_id").eq("shop_id", shop.id).eq("type", "visit").gte("created_at", since).limit(20000),
    supabase.from("reviews").select("rating").eq("shop_id", shop.id).limit(2000),
    supabase.from("events").select("type, product_id").eq("shop_id", shop.id).in("type", ["product_view", "add_to_cart"]).gte("created_at", since).limit(20000),
  ]);

  const items = (products.data ?? []) as unknown as {
    id: string;
    name: string;
    old_price: number | null;
    badge: string | null;
    sold_out: boolean;
    description: string | null;
    images: unknown[] | null;
  }[];
  const withoutPhoto = items.filter((item) => !item.images || item.images.length === 0).length;
  const withoutDescription = items.filter((item) => !item.description || item.description.trim() === "").length;
  const promos = items.filter((item) => item.badge === "promo" || item.old_price !== null).length;
  const soldOut = items.filter((item) => item.sold_out).length;

  const orderRows = orders.data ?? [];
  const delivered = orderRows.filter((row) => row.status === "delivered");
  const revenue = delivered.reduce((sum, row) => sum + Number(row.total_amount), 0);
  const visitors = new Set((visits.data ?? []).map((row) => row.session_id as string | null).filter(Boolean)).size;
  const ratings = (reviews.data ?? []).map((row) => Number(row.rating));
  const average = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;

  // Produits les plus consultés (si les statistiques par produit sont actives)
  const names = new Map(items.map((item) => [item.id, item.name]));
  const perProduct = new Map<string, { views: number; carts: number }>();
  if (!productEvents.error) {
    for (const row of productEvents.data ?? []) {
      const id = row.product_id as string | null;
      if (!id || !names.has(id)) continue;
      const entry = perProduct.get(id) ?? { views: 0, carts: 0 };
      if (row.type === "product_view") entry.views += 1;
      else entry.carts += 1;
      perProduct.set(id, entry);
    }
  }
  const top = [...perProduct.entries()]
    .sort((a, b) => b[1].views + b[1].carts * 2 - (a[1].views + a[1].carts * 2))
    .slice(0, 3)
    .map(([id, value]) => `${names.get(id)} (${value.views} vues, ${value.carts} ajouts au panier)`);

  const lines = [
    `Boutique : ${shop.shop_name}`,
    `Produits : ${items.length} (sans photo : ${withoutPhoto}, sans description : ${withoutDescription}, en promotion : ${promos}, épuisés : ${soldOut})`,
    `Catégories : ${categories.count ?? 0}`,
    `Livraison : ${shop.delivery_enabled ? `oui (${zones.count ?? 0} zones)` : "non"} ; retrait en boutique : ${shop.pickup_enabled ? "oui" : "non"}`,
    `Modes de paiement acceptés : ${shop.payment_methods.length > 0 ? shop.payment_methods.join(", ") : "aucun renseigné"}`,
    `Numéro WhatsApp réel configuré : ${shop.whatsapp_number !== DEMO_WHATSAPP ? "oui" : "non (numéro de démonstration)"}`,
    `Logo : ${shop.logo_url ? "oui" : "non"} ; page À propos : ${shop.about ? "oui" : "non"}`,
    `30 derniers jours : ${visitors} visiteurs, ${orderRows.length} commandes envoyées, ${delivered.length} livrées, chiffre d'affaires livré ${Math.round(revenue)} FCFA`,
    `Avis clients : ${ratings.length > 0 ? `${ratings.length} avis, moyenne ${average} sur 5` : "aucun avis pour le moment"}`,
  ];
  if (top.length > 0) lines.push(`Produits les plus consultés : ${top.join(" ; ")}`);
  return lines.join("\n");
}
