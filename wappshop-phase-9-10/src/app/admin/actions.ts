"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, GENERIC_ERROR, type ActionResult } from "@/lib/action-result";
import { loadSellers } from "@/lib/admin-data";
import { getAdmin } from "@/lib/admin";
import type { Audience } from "@/lib/admin-audience";
import { UUID_PATTERN } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";

// Actions réservées à l'administrateur : chacune revérifie l'identité côté serveur (un formulaire ne suffit jamais comme preuve).

const bodySchema = z.string().trim().min(1, "Écrivez un message").max(2000, "2000 caractères maximum");
const NOT_ADMIN = "Action réservée à l'administrateur.";

export async function sendAdminMessage(shopId: string, body: string): Promise<ActionResult> {
  if (!(await getAdmin())) return fail(NOT_ADMIN);
  if (!UUID_PATTERN.test(shopId)) return fail("Vendeur introuvable.");
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Message invalide.");

  const admin = createAdminClient();
  if (!admin) return fail("Clé serveur manquante (SUPABASE_SECRET_KEY).");
  const { error } = await admin.from("messages").insert({ shop_id: shopId, sender: "admin", kind: "chat", body: parsed.data });
  if (error) {
    console.error("sendAdminMessage", error.message);
    if (error.code === "42P01") return fail("La messagerie demande le script phase9.sql dans Supabase.");
    return fail(GENERIC_ERROR);
  }
  revalidatePath(`/admin/vendeurs/${shopId}`);
  revalidatePath("/admin");
  return { ok: true };
}

/** Envoie la même annonce à plusieurs vendeurs (un message par conversation). */
export async function sendAnnouncement(audience: Audience, body: string): Promise<ActionResult<{ count: number }>> {
  if (!(await getAdmin())) return fail(NOT_ADMIN);
  if (!["all", "no_products", "no_orders"].includes(audience)) return fail("Public invalide.");
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Message invalide.");

  const data = await loadSellers();
  if (!data) return fail("Clé serveur manquante (SUPABASE_SECRET_KEY).");
  const targets = data.sellers.filter((seller) => (audience === "all" ? true : audience === "no_products" ? seller.products === 0 : seller.orders === 0));
  if (targets.length === 0) return fail("Aucun vendeur ne correspond à ce public.");

  const admin = createAdminClient();
  if (!admin) return fail("Clé serveur manquante (SUPABASE_SECRET_KEY).");
  for (let start = 0; start < targets.length; start += 500) {
    const rows = targets.slice(start, start + 500).map((seller) => ({ shop_id: seller.shopId, sender: "admin", kind: "announcement", body: parsed.data }));
    const { error } = await admin.from("messages").insert(rows);
    if (error) {
      console.error("sendAnnouncement", error.message);
      if (error.code === "42P01") return fail("La messagerie demande le script phase9.sql dans Supabase.");
      return fail(GENERIC_ERROR);
    }
  }
  revalidatePath("/admin");
  return { ok: true, data: { count: targets.length } };
}
