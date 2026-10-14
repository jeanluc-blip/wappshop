import type { Metadata } from "next";
import { ProductForm } from "@/components/dashboard/ProductForm";
import { requireShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nouveau produit" };

export default async function NewProductPage() {
  const { user, shop } = await requireShop();
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, category_name").eq("shop_id", shop.id).order("created_at");
  const categories = (data ?? []).map((row) => ({ id: row.id as string, name: row.category_name as string }));

  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Nouveau produit</h1>
      <ProductForm userId={user.id} categories={categories} />
    </>
  );
}
