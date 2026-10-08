import type { Product } from "@/lib/catalog";

/** Étiquette en haut à gauche de la photo : Épuisé, Promo ou Nouveau (dans cet ordre de priorité). */
export function ProductBadge({ product }: { product: Pick<Product, "badge" | "soldOut"> }) {
  if (product.soldOut) {
    return <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-[#4b5563] px-2.5 py-0.5 text-xs font-bold text-white">Épuisé</span>;
  }
  if (product.badge === "promo") {
    return <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-[#b91c1c] px-2.5 py-0.5 text-xs font-bold text-white">Promo</span>;
  }
  if (product.badge === "new") {
    return <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-foreground/80 px-2.5 py-0.5 text-xs font-bold text-white">Nouveau</span>;
  }
  return null;
}
