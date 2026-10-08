"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, GENERIC_ERROR, type ActionResult } from "@/lib/action-result";
import { getShopContext } from "@/lib/shop";
import { ownedObjectPath } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { categoryNameSchema } from "@/lib/validators";

const SESSION_ERROR = "Votre session a expiré. Reconnectez-vous.";
const idSchema = z.guid();

function refresh(slug: string) {
  revalidatePath(`/${slug}`);
  revalidatePath("/dashboard", "layout");
}

/** `undefined` = inchangée, `null` = supprimer la photo, texte = nouvelle photo (adresse Storage du vendeur). */
type CategoryImage = string | null | undefined;

export async function createCategory(name: string, imageUrl: CategoryImage): Promise<ActionResult> {
  const ctx = await getShopContext();
  if (!ctx) return fail(SESSION_ERROR);

  const parsedName = categoryNameSchema.safeParse(name);
  if (!parsedName.success) return fail(parsedName.error.issues[0].message);
  if (imageUrl && !ownedObjectPath(imageUrl, "product-images", ctx.user.id)) return fail("Photo invalide : réessayez.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .insert({ shop_id: ctx.shop.id, category_name: parsedName.data, image_url: imageUrl ?? null });
  if (error) {
    if (error.code === "23505") return fail("Une catégorie porte déjà ce nom.");
    console.error("createCategory", error);
    return fail(GENERIC_ERROR);
  }
  refresh(ctx.shop.slug);
  return { ok: true };
}

export async function updateCategory(
  id: string,
  changes: { name?: string; imageUrl?: CategoryImage },
): Promise<ActionResult> {
  const ctx = await getShopContext();
  if (!ctx) return fail(SESSION_ERROR);
  if (!idSchema.safeParse(id).success) return fail("Catégorie introuvable.");

  const update: Record<string, unknown> = {};
  if (changes.name !== undefined) {
    const parsedName = categoryNameSchema.safeParse(changes.name);
    if (!parsedName.success) return fail(parsedName.error.issues[0].message);
    update.category_name = parsedName.data;
  }
  if (changes.imageUrl !== undefined) {
    if (changes.imageUrl && !ownedObjectPath(changes.imageUrl, "product-images", ctx.user.id)) {
      return fail("Photo invalide : réessayez.");
    }
    update.image_url = changes.imageUrl;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("categories")
    .select("image_url")
    .eq("id", id)
    .eq("shop_id", ctx.shop.id)
    .maybeSingle<{ image_url: string | null }>();
  if (!current) return fail("Catégorie introuvable.");

  const { error } = await supabase.from("categories").update(update).eq("id", id).eq("shop_id", ctx.shop.id);
  if (error) {
    if (error.code === "23505") return fail("Une catégorie porte déjà ce nom.");
    console.error("updateCategory", error);
    return fail(GENERIC_ERROR);
  }

  if (changes.imageUrl !== undefined && current.image_url && current.image_url !== changes.imageUrl) {
    const oldPath = ownedObjectPath(current.image_url, "product-images", ctx.user.id);
    if (oldPath) await supabase.storage.from("product-images").remove([oldPath]);
  }
  refresh(ctx.shop.slug);
  return { ok: true };
}

/** Les produits liés passent à « sans catégorie » (clé étrangère `on delete set null`). */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const ctx = await getShopContext();
  if (!ctx) return fail(SESSION_ERROR);
  if (!idSchema.safeParse(id).success) return fail("Catégorie introuvable.");

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("categories")
    .select("image_url")
    .eq("id", id)
    .eq("shop_id", ctx.shop.id)
    .maybeSingle<{ image_url: string | null }>();
  if (!current) return fail("Catégorie introuvable.");

  const { error } = await supabase.from("categories").delete().eq("id", id).eq("shop_id", ctx.shop.id);
  if (error) {
    console.error("deleteCategory", error);
    return fail(GENERIC_ERROR);
  }
  const path = ownedObjectPath(current.image_url, "product-images", ctx.user.id);
  if (path) await supabase.storage.from("product-images").remove([path]);

  refresh(ctx.shop.slug);
  return { ok: true };
}
