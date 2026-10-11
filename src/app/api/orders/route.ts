import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { groupVariants, isCompleteSelection, unitPrice, type Product, type Selection } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderInputSchema } from "@/lib/validators";
import { buildOrderMessage, waLink } from "@/lib/whatsapp";

// Enregistre une commande avant la redirection WhatsApp.
// RÈGLE : rien de ce qui compte (prix, suppléments, frais, total) ne vient du navigateur.

const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status });

type ProductRow = {
  id: string;
  name: string;
  price: number;
  sold_out: boolean;
  variants: { id: string; variant_name: string; variant_value: string; price_supplement: number; position: number }[];
};

/** Options lisibles pour le message : « Taille: L, Couleur: Noir ». */
function optionsText(product: Product, selection: Selection): string {
  return groupVariants(product.variants)
    .map((group) => `${group.name}: ${selection[group.name]}`)
    .join(", ");
}

export async function POST(request: NextRequest) {
  if (isRateLimited(`orders:${clientIp(request)}`, 10)) {
    return json({ error: "Trop de tentatives. Réessayez dans une minute." }, 429);
  }
  if (Number(request.headers.get("content-length") ?? 0) > 20_000) return json({ error: "Requête trop volumineuse." }, 413);

  const parsed = orderInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Commande invalide." }, 400);
  const input = parsed.data;

  const admin = createAdminClient();
  if (!admin) {
    console.error("Commande impossible : SUPABASE_SECRET_KEY n'est pas configurée.");
    return json({ error: "Les commandes sont momentanément indisponibles." }, 503);
  }

  const { data: shop } = await admin
    .from("shops")
    .select("id, shop_name, slug, whatsapp_number, delivery_enabled, pickup_enabled, pickup_address, payment_methods")
    .eq("slug", input.slug)
    .maybeSingle();
  if (!shop) return json({ error: "Boutique introuvable." }, 404);

  // Modes de réception : seulement ceux que le vendeur propose.
  if (input.fulfillment === "delivery" && !shop.delivery_enabled) return json({ error: "La livraison n'est pas proposée." }, 400);
  if (input.fulfillment === "pickup" && !shop.pickup_enabled) return json({ error: "Le retrait n'est pas proposé." }, 400);

  // Articles : lus en base, uniquement dans CETTE boutique.
  const ids = [...new Set(input.items.map((item) => item.productId))];
  const { data: rows, error: productsError } = await admin
    .from("products")
    .select("id, name, price, sold_out, variants(id, variant_name, variant_value, price_supplement, position)")
    .eq("shop_id", shop.id)
    .in("id", ids)
    .returns<ProductRow[]>();
  if (productsError) {
    console.error("orders(products)", productsError.message);
    return json({ error: "Une erreur est survenue. Réessayez." }, 500);
  }
  const products = new Map<string, Product>(
    (rows ?? []).map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        price: Number(row.price),
        oldPrice: null,
        badge: "none",
        soldOut: row.sold_out,
        featured: false,
        description: null,
        categoryId: null,
        images: [],
        variants: [...row.variants]
          .sort((a, b) => a.position - b.position)
          .map((v) => ({ id: v.id, name: v.variant_name, value: v.variant_value, supplement: Number(v.price_supplement) })),
      },
    ]),
  );

  const items: { product_id: string; name: string; options: string; selection: Selection; qty: number; unit_price: number; subtotal: number }[] = [];
  for (const line of input.items) {
    const product = products.get(line.productId);
    if (!product) return json({ error: "Un article n'existe plus dans cette boutique. Rechargez la page." }, 409);
    if (product.soldOut) return json({ error: `« ${product.name} » est épuisé. Retirez-le du panier.` }, 409);
    if (!isCompleteSelection(product, line.selection)) {
      return json({ error: `Choix invalide pour « ${product.name} ». Rechargez la page.` }, 409);
    }
    const unit = unitPrice(product, line.selection);
    items.push({
      product_id: product.id,
      name: product.name,
      options: optionsText(product, line.selection),
      selection: line.selection,
      qty: line.qty,
      unit_price: unit,
      subtotal: unit * line.qty,
    });
  }
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  // Livraison : zone vérifiée en base ; retrait : adresse du vendeur.
  let deliveryFee = 0;
  let zoneName: string | null = null;
  let address: string | null;
  if (input.fulfillment === "delivery") {
    const { data: zones } = await admin.from("delivery_zones").select("id, name, fee").eq("shop_id", shop.id);
    if ((zones ?? []).length > 0) {
      const zone = (zones ?? []).find((candidate) => candidate.id === input.zoneId);
      if (!zone) return json({ error: "Choisissez une zone de livraison." }, 400);
      zoneName = zone.name as string;
      deliveryFee = Number(zone.fee);
    }
    address = input.address?.trim() || null;
    if (!address || address.length < 3) return json({ error: "Indiquez votre adresse ou un point de repère." }, 400);
  } else {
    address = (shop.pickup_address as string | null) ?? null;
  }

  // Paiement : parmi les modes du vendeur.
  const methods = (shop.payment_methods as string[] | null) ?? [];
  let payment: string | null = null;
  if (methods.length > 0) {
    if (!input.paymentMethod || !methods.includes(input.paymentMethod)) return json({ error: "Choisissez un mode de paiement." }, 400);
    payment = input.paymentMethod;
  }

  const total = subtotal + deliveryFee;
  const { data: order, error: insertError } = await admin
    .from("orders")
    .insert({
      shop_id: shop.id,
      items_details: items,
      total_amount: total,
      status: "new",
      customer_name: input.customerName,
      fulfillment: input.fulfillment,
      delivery_zone: zoneName,
      delivery_address: address,
      delivery_fee: deliveryFee,
      payment_method: payment,
    })
    .select("id, order_number")
    .single();
  if (insertError || !order) {
    console.error("orders(insert)", insertError?.message);
    return json({ error: "Impossible d'enregistrer la commande. Réessayez." }, 500);
  }

  await admin.from("events").insert({ shop_id: shop.id, type: "checkout" });

  const message = buildOrderMessage({
    shopName: shop.shop_name as string,
    orderNumber: Number(order.order_number),
    customerName: input.customerName,
    fulfillment: input.fulfillment,
    zone: zoneName,
    address,
    items: items.map((item) => ({ name: item.name, options: item.options, qty: item.qty, subtotal: formatPrice(item.subtotal) })),
    subtotal: formatPrice(subtotal),
    deliveryFee: deliveryFee > 0 ? formatPrice(deliveryFee) : null,
    total: formatPrice(total),
    payment,
  });

  revalidatePath("/dashboard", "layout");
  return json(
    {
      orderNumber: Number(order.order_number),
      subtotal,
      deliveryFee,
      total,
      message,
      whatsappUrl: waLink(shop.whatsapp_number as string, message),
    },
    201,
  );
}
