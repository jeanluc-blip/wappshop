import "server-only";
import { loadSellers, type SellerSummary } from "@/lib/admin-data";

// Contexte de l'assistant administrateur : chiffres de la plateforme et des vendeurs qui ont besoin d'aide.
// Contient les noms de boutiques (publics) et des chiffres. Jamais d'email, de téléphone ni de données de clients.

const DAY = 86_400_000;
const daysSince = (iso: string | null): number | null => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null);

function describe(seller: SellerSummary): string {
  const seen = daysSince(seller.lastSignInAt);
  return [
    seller.shopName,
    `${seller.products} produit${seller.products > 1 ? "s" : ""}`,
    `${seller.orders} commande${seller.orders > 1 ? "s" : ""} (${seller.delivered} livrée${seller.delivered > 1 ? "s" : ""})`,
    `inscrit il y a ${daysSince(seller.createdAt)} j`,
    seen === null ? "jamais reconnecté" : `vu il y a ${seen} j`,
    seller.unreadFromSeller > 0 ? `${seller.unreadFromSeller} message(s) non lu(s) de sa part` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export async function buildAdminContext(): Promise<string> {
  const data = await loadSellers();
  if (!data) return "Chiffres indisponibles (clé serveur absente).";
  const { sellers } = data;

  const withProducts = sellers.filter((seller) => seller.products > 0).length;
  const withOrders = sellers.filter((seller) => seller.orders > 0).length;
  const noProducts = sellers.filter((seller) => seller.products === 0);
  const noOrders = sellers.filter((seller) => seller.products > 0 && seller.orders === 0);
  const inactive = sellers.filter((seller) => (daysSince(seller.lastSignInAt) ?? 999) > 14);
  const recent = sellers.filter((seller) => (daysSince(seller.createdAt) ?? 999) <= 7);
  const unread = sellers.reduce((sum, seller) => sum + seller.unreadFromSeller, 0);
  const revenue = sellers.reduce((sum, seller) => sum + seller.revenueDelivered, 0);

  // À accompagner en priorité : messages non lus d'abord, puis boutiques vides récentes, puis produits sans commande.
  const attention = [...sellers]
    .map((seller) => ({
      seller,
      score: seller.unreadFromSeller * 100 + (seller.products === 0 ? 30 : 0) + (seller.products > 0 && seller.orders === 0 ? 20 : 0) + ((daysSince(seller.lastSignInAt) ?? 999) > 14 ? 10 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((entry) => `- ${describe(entry.seller)}`);

  const best = [...sellers]
    .filter((seller) => seller.delivered > 0)
    .sort((a, b) => b.revenueDelivered - a.revenueDelivered)
    .slice(0, 5)
    .map((seller) => `- ${seller.shopName} : ${seller.delivered} livrée(s), ${Math.round(seller.revenueDelivered)} FCFA`);

  return [
    `Vendeurs inscrits : ${sellers.length} (dont ${recent.length} inscrits depuis 7 jours)`,
    `Avec au moins un produit : ${withProducts} ; avec au moins une commande : ${withOrders}`,
    `Sans produit : ${noProducts.length} ; avec produits mais sans commande : ${noOrders.length} ; inactifs depuis plus de 14 jours : ${inactive.length}`,
    `Messages de vendeurs non lus : ${unread}`,
    `Chiffre d'affaires livré cumulé de tous les vendeurs : ${Math.round(revenue)} FCFA`,
    attention.length > 0 ? `Vendeurs à accompagner en priorité :\n${attention.join("\n")}` : "Aucun vendeur ne demande d'attention particulière.",
    best.length > 0 ? `Vendeurs qui vendent le plus :\n${best.join("\n")}` : "Aucune commande livrée pour le moment.",
  ].join("\n");
}
