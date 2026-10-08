"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, GENERIC_ERROR, type ActionResult } from "@/lib/action-result";
import { getShopContext } from "@/lib/shop";
import { ownedObjectPath } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { MAX_PRODUCT_IMAGES, parsePrice, productFormSchema } from "@/lib/validators";

const SESSION_ERROR = "Votre session a expiré. Reconnectez-vous.";
const idSchema = z.guid();

function refresh(slug: string) {
  revalidatePath(`/${slug}`);
  revalidatePath("/dashboard", "layout");
}

type SaveProductInput = {
  /** Absent : création. */
  id?: string;
  values: unknown;
  /** Adresses Storage des photos, dans l'ordre d'affichage (la première est la principale). */
  imageUrls: string[];
};

export async function saveProduct(input: SaveProductInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getShopContext();
  if (!ctx) return fail(SESSION_ERROR);

  const parsed = productFormSchema.safeParse(input.values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, issue.path.join("."));
  }
  const values = parsed.data;
  const price = parsePrice(values.price);
  if (price === null) return fail("Prix invalide", "price");

  // Photos : au plus 8, toutes dans le dossier du vendeur (jamais d'adresse arbitraire).
  const imageUrls = [...new Set(input.imageUrls)];
  if (imageUrls.length > MAX_PRODUCT_IMAGES) return fail(`${MAX_PRODUCT_IMAGES} photos maximum.`);
  for (const url of imageUrls) {
    if (!ownedObjectPath(url, "product-images", ctx.user.id)) return fail("Photo invalide : réessayez de l'importer.");
  }

  const supabase = await createClient();

  // Catégorie : doit appartenir à la boutique du vendeur.
  let categoryId: string | null = null;
  if (values.categoryId) {
    if (!idSchema.safeParse(values.categoryId).success) return fail("Catégorie introuvable.", "categoryId");
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("id", values.categoryId)
      .eq("shop_id", ctx.shop.id)
      .maybeSingle();
    if (!category) return fail("Catégorie introuvable.", "categoryId");
    categoryId = category.id as string;
  }

  const isPromo = values.badge === "promo";
  const row = {
    category_id: categoryId,
    name: values.name,
    price,
    badge: values.badge,
    old_price: isPromo ? parsePrice(values.oldPrice) : null,
    sold_out: values.soldOut,
    description: values.description || null,
  };

  let productId: string;
  if (input.id) {
    if (!idSchema.safeParse(input.id).success) return fail("Produit introuvable.");
    const { data: updated, error } = await supabase
      .from("products")
      .update(row)
      .eq("id", input.id)
      .eq("shop_id", ctx.shop.id)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("saveProduct(update)", error);
      return fail(GENERIC_ERROR);
    }
    if (!updated) return fail("Produit introuvable.");
    productId = updated.id as string;
  } else {
    const { data: created, error } = await supabase
      .from("products")
      .insert({ ...row, shop_id: ctx.shop.id })
      .select("id")
      .single();
    if (error) {
      console.error("saveProduct(insert)", error);
      return fail(GENERIC_ERROR);
    }
    productId = created.id as string;
  }

  // Photos : suppression des retirées, nouvel ordre pour les conservées, ajout des nouvelles.
  const { data: existingImages, error: imagesListError } = await supabase
    .from("images")
    .select("id, image_url, position")
    .eq("product_id", productId);
  if (imagesListError) {
    console.error("saveProduct(images list)", imagesListError);
    return fail(GENERIC_ERROR);
  }
  const existing = existingImages ?? [];
  const wanted = new Set(imageUrls);
  const removed = existing.filter((image) => !wanted.has(image.image_url as string));

  if (removed.length > 0) {
    const { error } = await supabase
      .from("images")
      .delete()
      .in(
        "id",
        removed.map((image) => image.id as string),
      );
    if (error) {
      console.error("saveProduct(images delete)", error);
      return fail(GENERIC_ERROR);
    }
  }

  const byUrl = new Map(existing.map((image) => [image.image_url as string, image]));
  const newRows: { product_id: string; image_url: string; position: number }[] = [];
  for (const [position, url] of imageUrls.entries()) {
    const current = byUrl.get(url);
    if (!current) {
      newRows.push({ product_id: productId, image_url: url, position });
    } else if (current.position !== position) {
      const { error } = await supabase.from("images").update({ position }).eq("id", current.id as string);
      if (error) {
        console.error("saveProduct(images reorder)", error);
        return fail(GENERIC_ERROR);
      }
    }
  }
  if (newRows.length > 0) {
    const { error } = await supabase.from("images").insert(newRows);
    if (error) {
      console.error("saveProduct(images insert)", error);
      return fail(GENERIC_ERROR);
    }
  }

  // Variantes : on ajoute les nouvelles lignes d'abord, puis on retire les anciennes (rien n'est perdu en cas d'échec).
  const { data: oldVariants } = await supabase.from("variants").select("id").eq("product_id", productId);
  if (values.variants.length > 0) {
    const { error } = await supabase.from("variants").insert(
      values.variants.map((variant, position) => ({
        product_id: productId,
        variant_name: variant.name,
        variant_value: variant.value,
        price_supplement: parsePrice(variant.supplement) ?? 0,
        position,
      })),
    );
    if (error) {
      console.error("saveProduct(variants insert)", error);
      return fail(GENERIC_ERROR);
    }
  }
  if (oldVariants && oldVariants.length > 0) {
    const { error } = await supabase
      .from("variants")
      .delete()
      .in(
        "id",
        oldVariants.map((variant) => variant.id as string),
      );
    if (error) console.error("saveProduct(variants delete)", error);
  }

  // Fichiers des photos retirées : nettoyage du stockage (un échec n'empêche pas l'enregistrement).
  const removedPaths = removed
    .map((image) => ownedObjectPath(image.image_url as string, "product-images", ctx.user.id))
    .filter((path): path is string => path !== null);
  if (removedPaths.length > 0) await supabase.storage.from("product-images").remove(removedPaths);

  refresh(ctx.shop.slug);
  return { ok: true, data: { id: productId } };
}

/** Épuisé / de nouveau en vente, depuis la liste du catalogue. */
export async function setProductSoldOut(id: string, soldOut: boolean): Promise<ActionResult> {
  const ctx = await getShopContext();
  if (!ctx) return fail(SESSION_ERROR);
  if (!idSchema.safeParse(id).success) return fail("Produit introuvable.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ sold_out: soldOut })
    .eq("id", id)
    .eq("shop_id", ctx.shop.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("setProductSoldOut", error);
    return fail(GENERIC_ERROR);
  }
  if (!data) return fail("Produit introuvable.");
  refresh(ctx.shop.slug);
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const ctx = await getShopContext();
  if (!ctx) return fail(SESSION_ERROR);
  if (!idSchema.safeParse(id).success) return fail("Produit introuvable.");

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .eq("shop_id", ctx.shop.id)
    .maybeSingle();
  if (!product) return fail("Produit introuvable.");

  const { data: images } = await supabase.from("images").select("image_url").eq("product_id", id);

  // Les photos et variantes disparaissent avec le produit (on delete cascade).
  const { error } = await supabase.from("products").delete().eq("id", id).eq("shop_id", ctx.shop.id);
  if (error) {
    console.error("deleteProduct", error);
    return fail(GENERIC_ERROR);
  }

  const paths = (images ?? [])
    .map((image) => ownedObjectPath(image.image_url as string, "product-images", ctx.user.id))
    .filter((path): path is string => path !== null);
  if (paths.length > 0) await supabase.storage.from("product-images").remove(paths);

  refresh(ctx.shop.slug);
  return { ok: true };
}
