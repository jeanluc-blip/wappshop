"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, GENERIC_ERROR, type ActionResult } from "@/lib/action-result";
import { getShopContext } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.string().trim().min(1, "Écrivez un message").max(2000, "2000 caractères maximum");

// Limite simple en mémoire : au plus 20 messages par 10 minutes et par vendeur.
const recent = new Map<string, number[]>();
function tooMany(userId: string): boolean {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((time) => now - time < 10 * 60_000);
  hits.push(now);
  recent.set(userId, hits);
  return hits.length > 20;
}

/** Le vendeur écrit à l'équipe WappShop (sa boutique uniquement : la sécurité de la base vérifie le propriétaire). */
export async function sendSellerMessage(body: string): Promise<ActionResult> {
  const ctx = await getShopContext();
  if (!ctx) return fail("Votre session a expiré. Reconnectez-vous.");
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Message invalide.");
  if (tooMany(ctx.user.id)) return fail("Trop de messages en peu de temps. Réessayez dans quelques minutes.");

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({ shop_id: ctx.shop.id, sender: "seller", kind: "chat", body: parsed.data });
  if (error) {
    console.error("sendSellerMessage", error.message);
    return fail(GENERIC_ERROR);
  }
  revalidatePath("/dashboard/messages");
  return { ok: true };
}
