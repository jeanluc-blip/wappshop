import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ProductForm } from "@/components/dashboard/ProductForm";
import { requireShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Modifier le produit" };

type Row = {
  id: string;
  name: string;
  price: number;
  old_price: number | null;
  badge: "none" | "new" | "promo";
  sold_out: boolean;
  description: string | null;
  category_id: string | null;
  images: { image_url: string; position: number }[];
  variants: { variant_name: string; variant_value: string; price_supplement: number; position: number }[];
};

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();

  const { user, shop } = await requireShop();
  const supabase = await createClient();

  // Filtré sur la boutique du vendeur : le produit d'un autre vendeur renvoie « introuvable ».
  const [product, categories] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, price, old_price, badge, sold_out, description, category_id, images(image_url, position), variants(variant_name, variant_value, price_supplement, position)",
      )
      .eq("id", id)
      .eq("shop_id", shop.id)
      .maybeSingle<Row>(),
    supabase.from("categories").select("id, category_name").eq("shop_id", shop.id).order("created_at"),
  ]);
  if (!product.data) notFound();
  const row = product.data;

  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Modifier le produit</h1>
      <ProductForm
        key={row.id}
        userId={user.id}
        categories={(categories.data ?? []).map((c) => ({ id: c.id as string, name: c.category_name as string }))}
        product={{
          id: row.id,
          imageUrls: [...row.images].sort((a, b) => a.position - b.position).map((image) => image.image_url),
          values: {
            name: row.name,
            price: String(row.price),
            badge: row.badge,
            oldPrice: row.old_price === null ? "" : String(row.old_price),
            soldOut: row.sold_out,
            description: row.description ?? "",
            categoryId: row.category_id ?? "",
            variants: [...row.variants]
              .sort((a, b) => a.position - b.position)
              .map((variant) => ({
                name: variant.variant_name,
                value: variant.variant_value,
                supplement: Number(variant.price_supplement) ? String(variant.price_supplement) : "",
              })),
          },
        }}
      />
    </>
  );
}
