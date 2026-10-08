import "server-only";
import { cache } from "react";
import type { Badge, Category, Product, ShopPublic, Zone } from "@/lib/catalog";
import { createPublicClient } from "@/lib/supabase/public";

export type Storefront = {
  shop: ShopPublic;
  categories: Category[];
  products: Product[];
  zones: Zone[];
};

// Colonnes publiques uniquement : l'accès anonyme à `shops` est limité à cette liste (jamais user_id).
const SHOP_COLUMNS =
  "id, shop_name, slug, logo_url, whatsapp_number, delivery_enabled, pickup_enabled, pickup_address, payment_methods, payment_note, about, opening_hours, social_url, announcement";

type ShopRow = {
  id: string;
  shop_name: string;
  slug: string;
  logo_url: string | null;
  whatsapp_number: string;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  pickup_address: string | null;
  payment_methods: string[];
  payment_note: string | null;
  about: string | null;
  opening_hours: string | null;
  social_url: string | null;
  announcement: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  price: number;
  old_price: number | null;
  badge: Badge;
  sold_out: boolean;
  description: string | null;
  category_id: string | null;
  images: { image_url: string; position: number }[];
  variants: { id: string; variant_name: string; variant_value: string; price_supplement: number; position: number }[];
};

/**
 * Boutique publique, lue avec les droits d'un visiteur. `null` si l'adresse n'existe pas.
 * Une erreur de lecture est relancée (jamais confondue avec « introuvable », pour ne pas mettre une 404 en cache).
 */
export const getStorefront = cache(async (slug: string): Promise<Storefront | null> => {
  const supabase = createPublicClient();

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("slug", slug)
    .maybeSingle<ShopRow>();
  if (shopError) throw new Error(`Lecture de la boutique impossible : ${shopError.message}`);
  if (!shop) return null;

  const [categories, products, zones] = await Promise.all([
    supabase.from("categories").select("id, category_name, image_url").eq("shop_id", shop.id).order("created_at"),
    supabase
      .from("products")
      .select(
        "id, name, price, old_price, badge, sold_out, description, category_id, images(image_url, position), variants(id, variant_name, variant_value, price_supplement, position)",
      )
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<ProductRow[]>(),
    supabase.from("delivery_zones").select("id, name, fee, position").eq("shop_id", shop.id).order("position").order("name"),
  ]);
  for (const result of [categories, products, zones]) {
    if (result.error) throw new Error(`Lecture du catalogue impossible : ${result.error.message}`);
  }

  return {
    shop: {
      id: shop.id,
      name: shop.shop_name,
      slug: shop.slug,
      logoUrl: shop.logo_url,
      whatsapp: shop.whatsapp_number,
      deliveryEnabled: shop.delivery_enabled,
      pickupEnabled: shop.pickup_enabled,
      pickupAddress: shop.pickup_address,
      paymentMethods: shop.payment_methods ?? [],
      paymentNote: shop.payment_note,
      about: shop.about,
      openingHours: shop.opening_hours,
      socialUrl: shop.social_url,
      announcement: shop.announcement,
    },
    categories: (categories.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.category_name as string,
      imageUrl: (row.image_url as string | null) ?? null,
    })),
    products: (products.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      oldPrice: row.old_price === null ? null : Number(row.old_price),
      badge: row.badge,
      soldOut: row.sold_out,
      description: row.description,
      categoryId: row.category_id,
      images: [...row.images].sort((a, b) => a.position - b.position).map((image) => image.image_url),
      variants: [...row.variants]
        .sort((a, b) => a.position - b.position)
        .map((variant) => ({
          id: variant.id,
          name: variant.variant_name,
          value: variant.variant_value,
          supplement: Number(variant.price_supplement),
        })),
    })),
    zones: (zones.data ?? []).map((row) => ({ id: row.id as string, name: row.name as string, fee: Number(row.fee) })),
  };
});
