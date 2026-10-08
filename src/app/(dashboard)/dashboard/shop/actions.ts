"use server";

import { revalidatePath } from "next/cache";
import { fail, GENERIC_ERROR, type ActionResult } from "@/lib/action-result";
import { getShopContext } from "@/lib/shop";
import { ownedObjectPath } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import {
  aboutSettingsSchema,
  DEMO_WHATSAPP,
  deliverySettingsSchema,
  normalizeWhatsapp,
  parsePrice,
  shopInfoSchema,
} from "@/lib/validators";

const SESSION_ERROR = "Votre session a expiré. Reconnectez-vous.";

function refresh(...slugs: string[]) {
  for (const slug of new Set(slugs)) revalidatePath(`/${slug}`);
  revalidatePath("/dashboard", "layout");
}

export type LogoChange = { action: "keep" } | { action: "remove" } | { action: "set"; url: string };

/** Nom, adresse personnalisée, numéro WhatsApp et logo. */
export async function updateShopInfo(input: unknown, logo: LogoChange): Promise<ActionResult<{ slug: string }>> {
  const ctx = await getShopContext();
  if (!ctx) return fail(SESSION_ERROR);

  const parsed = shopInfoSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, String(issue.path[0] ?? ""));
  }
  const whatsapp = normalizeWhatsapp(parsed.data.whatsapp);
  if (whatsapp === DEMO_WHATSAPP) {
    return fail("Ce numéro est un numéro de démonstration : saisissez le vôtre.", "whatsapp");
  }

  const supabase = await createClient();
  const update: Record<string, unknown> = {
    shop_name: parsed.data.shopName,
    slug: parsed.data.slug,
    whatsapp_number: whatsapp,
  };

  let newLogoUrl: string | null | undefined;
  if (logo.action === "set") {
    if (!ownedObjectPath(logo.url, "logos", ctx.user.id)) return fail("Logo invalide : réessayez de l'importer.");
    newLogoUrl = logo.url;
  } else if (logo.action === "remove") {
    newLogoUrl = null;
  }
  if (newLogoUrl !== undefined) update.logo_url = newLogoUrl;

  const { error } = await supabase.from("shops").update(update).eq("id", ctx.shop.id);
  if (error) {
    if (error.code === "23505") return fail("Cette adresse est déjà prise : choisissez-en une autre.", "slug");
    if (error.code === "23514") return fail("Adresse ou numéro refusé : vérifiez les champs.");
    console.error("updateShopInfo", error);
    return fail(GENERIC_ERROR);
  }

  // Ancien logo supprimé du stockage (un échec ici est sans conséquence).
  if (newLogoUrl !== undefined && ctx.shop.logo_url !== newLogoUrl) {
    const oldPath = ownedObjectPath(ctx.shop.logo_url, "logos", ctx.user.id);
    if (oldPath) await supabase.storage.from("logos").remove([oldPath]);
  }

  refresh(ctx.shop.slug, parsed.data.slug);
  return { ok: true, data: { slug: parsed.data.slug } };
}

/** Livraison, retrait, zones et modes de paiement. */
export async function updateDeliverySettings(input: unknown): Promise<ActionResult> {
  const ctx = await getShopContext();
  if (!ctx) return fail(SESSION_ERROR);

  const parsed = deliverySettingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("shops")
    .update({
      delivery_enabled: data.deliveryEnabled,
      pickup_enabled: data.pickupEnabled,
      pickup_address: data.pickupAddress || null,
      payment_methods: [...new Set(data.paymentMethods)],
      payment_note: data.paymentNote || null,
    })
    .eq("id", ctx.shop.id);
  if (error) {
    console.error("updateDeliverySettings(shop)", error);
    return fail(GENERIC_ERROR);
  }

  // Zones : suppression de celles retirées, mise à jour des existantes, ajout des nouvelles.
  const { data: existing, error: listError } = await supabase
    .from("delivery_zones")
    .select("id")
    .eq("shop_id", ctx.shop.id);
  if (listError) {
    console.error("updateDeliverySettings(list)", listError);
    return fail(GENERIC_ERROR);
  }
  const existingIds = new Set((existing ?? []).map((zone) => zone.id as string));
  const keptIds = new Set(data.zones.map((zone) => zone.id).filter((id): id is string => !!id && existingIds.has(id)));

  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("delivery_zones")
      .delete()
      .in("id", toDelete)
      .eq("shop_id", ctx.shop.id);
    if (deleteError) {
      console.error("updateDeliverySettings(delete)", deleteError);
      return fail(GENERIC_ERROR);
    }
  }

  const inserts: { shop_id: string; name: string; fee: number; position: number }[] = [];
  for (const [position, zone] of data.zones.entries()) {
    const fee = parsePrice(zone.fee) ?? 0;
    if (zone.id && keptIds.has(zone.id)) {
      const { error: updateError } = await supabase
        .from("delivery_zones")
        .update({ name: zone.name, fee, position })
        .eq("id", zone.id)
        .eq("shop_id", ctx.shop.id);
      if (updateError) {
        console.error("updateDeliverySettings(update zone)", updateError);
        return fail(GENERIC_ERROR);
      }
    } else {
      inserts.push({ shop_id: ctx.shop.id, name: zone.name, fee, position });
    }
  }
  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("delivery_zones").insert(inserts);
    if (insertError) {
      console.error("updateDeliverySettings(insert)", insertError);
      return fail(GENERIC_ERROR);
    }
  }

  refresh(ctx.shop.slug);
  return { ok: true };
}

/** Page « À propos » et bandeau d'annonce. */
export async function updateAboutSettings(input: unknown): Promise<ActionResult> {
  const ctx = await getShopContext();
  if (!ctx) return fail(SESSION_ERROR);

  const parsed = aboutSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, String(issue.path[0] ?? ""));
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("shops")
    .update({
      announcement: data.announcement || null,
      about: data.about || null,
      opening_hours: data.openingHours || null,
      social_url: data.socialUrl || null,
    })
    .eq("id", ctx.shop.id);
  if (error) {
    console.error("updateAboutSettings", error);
    return fail(GENERIC_ERROR);
  }

  refresh(ctx.shop.slug);
  return { ok: true };
}
