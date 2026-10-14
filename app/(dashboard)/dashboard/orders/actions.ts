"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, GENERIC_ERROR, type ActionResult } from "@/lib/action-result";
import { ORDER_STATUSES, UUID_PATTERN, type OrderStatus } from "@/lib/orders";
import { getShopContext } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  orderId: z.string().regex(UUID_PATTERN),
  status: z.enum(ORDER_STATUSES),
});

/** Change le statut d'une commande de SA boutique : Nouvelle, Confirmée ou Livrée (seule colonne modifiable par le vendeur). */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<ActionResult> {
  const ctx = await getShopContext();
  if (!ctx) return fail("Votre session a expiré. Reconnectez-vous.");

  const parsed = inputSchema.safeParse({ orderId, status });
  if (!parsed.success) return fail("Commande introuvable.");

  const supabase = await createClient();
  // Double protection : la sécurité de la base (RLS) et le filtre sur la boutique du vendeur.
  const { data, error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.orderId)
    .eq("shop_id", ctx.shop.id)
    .select("id");
  if (error) {
    console.error("Changement de statut impossible", error.message);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail("Commande introuvable.");

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/${ctx.shop.slug}`); // le nombre de commandes livrées est affiché sur la boutique
  return { ok: true };
}
