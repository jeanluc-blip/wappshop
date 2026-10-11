// Statistiques anonymes (côté navigateur) : quel produit est consulté ou ajouté au panier.
// Aucune donnée personnelle : seulement l'identifiant du produit et l'identifiant de session aléatoire de l'onglet.

export function track(slug: string, type: "product_view" | "add_to_cart", productId: string): void {
  try {
    const sessionId = sessionStorage.getItem(`wappshop-visit-${slug}`);
    if (!sessionId) return;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, sessionId, type, productId }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // stockage indisponible : on ne compte simplement pas
  }
}
