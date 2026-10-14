import type { Metadata } from "next";
import { CategoryManager, type CategoryItem } from "@/components/dashboard/CategoryManager";
import { requireShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Catégories" };

export default async function CategoriesPage() {
  const { user, shop } = await requireShop();
  const supabase = await createClient();

  const [categories, products] = await Promise.all([
    supabase.from("categories").select("id, category_name, image_url").eq("shop_id", shop.id).order("created_at"),
    supabase.from("products").select("category_id").eq("shop_id", shop.id),
  ]);

  const counts = new Map<string, number>();
  for (const product of products.data ?? []) {
    const id = product.category_id as string | null;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const items: CategoryItem[] = (categories.data ?? []).map((category) => ({
    id: category.id as string,
    name: category.category_name as string,
    imageUrl: (category.image_url as string | null) ?? null,
    productCount: counts.get(category.id as string) ?? 0,
  }));

  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Catégories</h1>
      <CategoryManager categories={items} userId={user.id} />
    </>
  );
}
