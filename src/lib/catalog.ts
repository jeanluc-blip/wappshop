// Types et calculs du catalogue, partagés par la boutique publique (et, en phase 5, par le serveur de commandes).

export type Badge = "none" | "new" | "promo";

export type Variant = { id: string; name: string; value: string; supplement: number };

export type Product = {
  id: string;
  name: string;
  price: number;
  oldPrice: number | null;
  badge: Badge;
  soldOut: boolean;
  description: string | null;
  categoryId: string | null;
  images: string[];
  variants: Variant[];
};

export type Category = { id: string; name: string; imageUrl: string | null };

export type Zone = { id: string; name: string; fee: number };

export type ShopPublic = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  whatsapp: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  pickupAddress: string | null;
  paymentMethods: string[];
  paymentNote: string | null;
  about: string | null;
  openingHours: string | null;
  socialUrl: string | null;
  announcement: string | null;
};

export type VariantGroup = { name: string; options: { value: string; supplement: number }[] };

/** Choix du client : nom de l'option → valeur (ex. { Taille: "L", Couleur: "Noir" }). */
export type Selection = Record<string, string>;

/** Variantes regroupées par option, dans l'ordre choisi par le vendeur. */
export function groupVariants(variants: Variant[]): VariantGroup[] {
  const groups: VariantGroup[] = [];
  for (const variant of variants) {
    let group = groups.find((item) => item.name === variant.name);
    if (!group) {
      group = { name: variant.name, options: [] };
      groups.push(group);
    }
    if (!group.options.some((option) => option.value === variant.value)) {
      group.options.push({ value: variant.value, supplement: variant.supplement });
    }
  }
  return groups;
}

/** Une valeur existe-t-elle bien pour chaque option du produit ? (aucune option inventée, aucune manquante) */
export function isCompleteSelection(product: Product, selection: Selection): boolean {
  const groups = groupVariants(product.variants);
  const names = Object.keys(selection);
  if (names.length !== groups.length) return false;
  return groups.every((group) => group.options.some((option) => option.value === selection[group.name]));
}

/** Prix final = prix de base + suppléments des variantes choisies. */
export function unitPrice(product: Product, selection: Selection): number {
  let total = product.price;
  for (const group of groupVariants(product.variants)) {
    const option = group.options.find((item) => item.value === selection[group.name]);
    if (option) total += option.supplement;
  }
  return total;
}

/** Texte lisible d'un choix : « L, Noir ». */
export function describeSelection(product: Product, selection: Selection): string {
  return groupVariants(product.variants)
    .map((group) => selection[group.name])
    .filter(Boolean)
    .join(", ");
}

/** Pour la recherche : minuscules et sans accents. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
