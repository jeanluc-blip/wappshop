import { NextResponse, type NextRequest } from "next/server";
import { priceOrder, type DbProduct, type DbShop, type DbZone } from "@/lib/order-pricing";
import { orderRequestSchema, type OrderResponse } from "@/lib/orders";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { looksLikeSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildOrderMessage, waLink } from "@/lib/whatsapp";

// Enregistrement d'une commande avant l'ouverture de WhatsApp.
// Le navigateur n'envoie que des identifiants et des quantités : prix, suppléments, frais de livraison,
// disponibilité et mode de paiement sont recalculés et vérifiés ici, à partir de la base.

const isLimited = createRateLimiter(8, 10 * 60_000); // 8 commandes par 10 minutes et par adresse IP
const MAX_BODY_BYTES = 32 * 1024;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  if (isLimited(clientIp(request))) return error("Trop de commandes en peu de temps. Réessayez dans quelques minutes.", 429);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return error("Commande trop volumineuse.", 413);

  const parsed = orderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Commande invalide.", 400);
  const input = parsed.data;
  if (!looksLikeSlug(input.slug)) return error("Boutique introuvable.", 404);

  const admin = createAdminClient();
  if (!admin) {
    console.error("Commande impossible : SUPABASE_SECRET_KEY n'est pas configurée.");
    return error("La commande n'est pas disponible pour le moment. Contactez le vendeur sur WhatsApp.", 503);
  }

  // Boutique du vendeur
  const { data: shop, error: shopError } = await admin
    .from("shops")
    .select("id, shop_name, whatsapp_number, delivery_enabled, pickup_enabled, pickup_address, payment_methods")
    .eq("slug", input.slug)
    .maybeSingle<DbShop & { id: string; whatsapp_number: string }>();
  if (shopError) {
    console.error("Lecture de la boutique impossible", shopError.message);
    return error("Une erreur est survenue. Réessayez dans un instant.", 500);
  }
  if (!shop) return error("Boutique introuvable.", 404);

  // Uniquement les produits de CETTE boutique (un identifiant d'une autre boutique est refusé plus bas).
  const productIds = [...new Set(input.lines.map((line) => line.productId))];
  const [products, zones] = await Promise.all([
    admin
      .from("products")
      .select("id, name, price, sold_out, variants(variant_name, variant_value, price_supplement)")
      .eq("shop_id", shop.id)
      .in("id", productIds)
      .returns<DbProduct[]>(),
    admin.from("delivery_zones").select("id, name, fee").eq("shop_id", shop.id).returns<DbZone[]>(),
  ]);
  if (products.error || zones.error) {
    console.error("Lecture du catalogue impossible", products.error?.message ?? zones.error?.message);
    return error("Une erreur est survenue. Réessayez dans un instant.", 500);
  }

  const priced = priceOrder(input, shop, products.data ?? [], zones.data ?? []);
  if (!priced.ok) return error(priced.error, 422);
  const order = priced.order;

  const { data: saved, error: insertError } = await admin
    .from("orders")
    .insert({
      shop_id: shop.id,
      items_details: order.items,
      total_amount: order.total,
      status: "new",
      customer_name: input.customerName,
      fulfillment: order.fulfillment,
      delivery_zone: order.zoneName,
      delivery_address: order.address,
      delivery_fee: order.deliveryFee,
      payment_method: order.paymentMethod,
    })
    .select("order_number")
    .single<{ order_number: number }>();
  if (insertError || !saved) {
    console.error("Enregistrement de la commande impossible", insertError?.message);
    return error("Votre commande n'a pas pu être enregistrée. Réessayez dans un instant.", 500);
  }

  // Statistiques : « commande envoyée » (ne prouve pas que le message WhatsApp est parti).
  const { error: eventError } = await admin
    .from("events")
    .insert({ shop_id: shop.id, type: "checkout", session_id: input.sessionId ?? null });
  if (eventError) console.error("Enregistrement de l'événement impossible", eventError.message);

  const message = buildOrderMessage({
    shopName: shop.shop_name,
    orderNumber: Number(saved.order_number),
    customerName: input.customerName,
    fulfillment: order.fulfillment,
    zoneName: order.zoneName,
    address: order.address,
    items: order.items,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    paymentMethod: order.paymentMethod,
  });

  const body: OrderResponse = {
    orderNumber: Number(saved.order_number),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    message,
    whatsappUrl: waLink(shop.whatsapp_number, message),
  };
  return NextResponse.json(body, { status: 201 });
}
