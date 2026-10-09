import type { Fulfillment, OrderItem, OrderRequest } from "@/lib/orders";

// Calcul d'une commande à partir des données de la base. Fonction pure : aucune confiance au navigateur.

export type DbVariant = { variant_name: string; variant_value: string; price_supplement: number | string };
export type DbProduct = { id: string; name: string; price: number | string; sold_out: boolean; variants: DbVariant[] };
export type DbZone = { id: string; name: string; fee: number | string };
export type DbShop = {
  shop_name: string;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  pickup_address: string | null;
  payment_methods: string[] | null;
};

export type PricedOrder = {
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  fulfillment: Fulfillment;
  zoneName: string | null;
  address: string | null;
  paymentMethod: string | null;
};

export type PricingResult = { ok: true; order: PricedOrder } | { ok: false; error: string };

/** Arrondi au centime : évite les écarts de virgule flottante (0,1 + 0,2). */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function priceOrder(request: OrderRequest, shop: DbShop, products: DbProduct[], zones: DbZone[]): PricingResult {
  // 1. Mode de réception : doit être proposé par le vendeur.
  if (request.fulfillment === "delivery" && !shop.delivery_enabled) return { ok: false, error: "Ce vendeur ne propose pas la livraison." };
  if (request.fulfillment === "pickup" && !shop.pickup_enabled) return { ok: false, error: "Ce vendeur ne propose pas le retrait en boutique." };

  // 2. Articles : prix, suppléments et disponibilité lus en base.
  const byId = new Map(products.map((product) => [product.id, product]));
  const items: OrderItem[] = [];
  for (const line of request.lines) {
    const product = byId.get(line.productId);
    if (!product) return { ok: false, error: "Un article de votre panier n'existe plus. Retirez-le et réessayez." };
    if (product.sold_out) return { ok: false, error: `« ${product.name} » est épuisé. Retirez-le de votre panier.` };

    // Options : exactement une valeur valable par option du produit, aucune option inventée.
    const optionNames = [...new Set(product.variants.map((variant) => variant.variant_name))];
    const chosenNames = Object.keys(line.selection);
    if (chosenNames.length !== optionNames.length || chosenNames.some((name) => !optionNames.includes(name))) {
      return { ok: false, error: `Choisissez toutes les options de « ${product.name} ».` };
    }
    let unit = Number(product.price);
    const variants: OrderItem["variants"] = [];
    for (const name of optionNames) {
      const chosen = product.variants.find((variant) => variant.variant_name === name && variant.variant_value === line.selection[name]);
      if (!chosen) return { ok: false, error: `Une option de « ${product.name} » n'est plus disponible. Retirez l'article et réessayez.` };
      unit += Number(chosen.price_supplement);
      variants.push({ name, value: chosen.variant_value });
    }
    unit = money(unit);
    items.push({ productId: product.id, name: product.name, variants, qty: line.qty, unitPrice: unit, subtotal: money(unit * line.qty) });
  }
  const subtotal = money(items.reduce((sum, item) => sum + item.subtotal, 0));

  // 3. Livraison ou retrait.
  let deliveryFee = 0;
  let zoneName: string | null = null;
  let address: string | null = null;
  if (request.fulfillment === "delivery") {
    if (zones.length > 0) {
      const zone = zones.find((item) => item.id === request.zoneId);
      if (!zone) return { ok: false, error: "Choisissez une zone de livraison." };
      zoneName = zone.name;
      deliveryFee = money(Number(zone.fee));
    }
    if (!request.address || request.address.length < 3) return { ok: false, error: "Indiquez votre adresse ou un point de repère." };
    address = request.address;
  } else {
    address = shop.pickup_address;
  }

  // 4. Paiement : doit être l'un des modes acceptés par le vendeur.
  const accepted = shop.payment_methods ?? [];
  let paymentMethod: string | null = null;
  if (accepted.length > 0) {
    if (!request.paymentMethod || !accepted.includes(request.paymentMethod)) return { ok: false, error: "Choisissez un mode de paiement." };
    paymentMethod = request.paymentMethod;
  }

  return {
    ok: true,
    order: { items, subtotal, deliveryFee, total: money(subtotal + deliveryFee), fulfillment: request.fulfillment, zoneName, address, paymentMethod },
  };
}
