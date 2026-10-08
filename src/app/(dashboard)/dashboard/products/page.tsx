import type { Metadata } from "next";
import Link from "next/link";
import { ProductRow, type ProductItem } from "@/components/dashboard/ProductRow";
import { Button } from "@/components/ui/button";
import { requireShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Catalogue" };

type Row = {
  id: string;
  name: string;
  price: number;
  old_price: number | null;
  badge: "none" | "new" | "promo";
  sold_out: boolean;
  categories: { category_name: string } | null;
  images: { image_url: string; position: number }[];
};

export default async function ProductsPage() {
  const { shop } = await requireShop();
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, price, old_price, badge, sold_out, categories(category_name), images(image_url, position)")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  const items: ProductItem[] = (data ?? []).map((row) => {
    const first = [...row.images].sort((a, b) => a.position - b.position)[0];
    return {
      id: row.id,
      name: row.name,
      price: Number(row.price),
      oldPrice: row.old_price === null ? null : Number(row.old_price),
      badge: row.badge,
      soldOut: row.sold_out,
      categoryName: row.categories?.category_name ?? null,
      imageUrl: first?.image_url ?? null,
      photoCount: row.images.length,
    };
  });

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Catalogue</h1>
        <Button asChild size="sm">
          <Link href="/dashboard/products/new">Ajouter un produit</Link>
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-muted">Votre catalogue est vide. Ajoutez votre premier produit.</p>
      ) : (
        <ul aria-label="Vos produits">
          {items.map((item) => (
            <ProductRow key={item.id} product={item} />
          ))}
        </ul>
      )}
    </>
  );
}
