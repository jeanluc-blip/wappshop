import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { UUID_PATTERN } from "@/lib/orders";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { looksLikeSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

// Dépôt d'un avis client, avec le lien à usage unique donné par le vendeur.
// Règles : commande « Livrée » seulement, un seul avis par commande, jeton non devinable,
// et le vendeur n'a aucun moyen d'écrire ni de modifier un avis (aucune politique d'écriture côté vendeur).

const isLimited = createRateLimiter(10, 10 * 60_000);

const bodySchema = z.object({
  slug: z.string().min(3).max(40),
  token: z.string().regex(UUID_PATTERN),
  rating: z.number().int().min(1, "Choisissez une note de 1 à 5").max(5, "Choisissez une note de 1 à 5"),
  comment: z.string().trim().max(300, "300 caractères maximum").optional(),
});

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  if (isLimited(clientIp(request))) return error("Trop de tentatives. Réessayez dans quelques minutes.", 429);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 4096) return error("Demande trop volumineuse.", 413);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Avis invalide.", 400);
  const { slug, token, rating } = parsed.data;
  const comment = parsed.data.comment ? parsed.data.comment : null;
  if (!looksLikeSlug(slug)) return error("Lien d'avis invalide.", 404);

  const admin = createAdminClient();
  if (!admin) {
    console.error("Avis impossible : SUPABASE_SECRET_KEY n'est pas configurée.");
    return error("L'envoi d'avis n'est pas disponible pour le moment.", 503);
  }

  const { data: shop } = await admin.from("shops").select("id").eq("slug", slug).maybeSingle<{ id: string }>();
  if (!shop) return error("Lien d'avis invalide.", 404);

  // La commande doit porter ce jeton ET appartenir à cette boutique (le lien d'une boutique ne marche pas pour une autre).
  const { data: order } = await admin
    .from("orders")
    .select("id, status")
    .eq("review_token", token)
    .eq("shop_id", shop.id)
    .maybeSingle<{ id: string; status: string }>();
  if (!order) return error("Lien d'avis invalide.", 404);
  if (order.status !== "delivered") return error("Vous pourrez donner votre avis dès que votre commande sera livrée.", 403);

  const { error: insertError } = await admin.from("reviews").insert({ order_id: order.id, shop_id: shop.id, rating, comment });
  if (insertError) {
    if (insertError.code === "23505") return error("Un avis a déjà été donné pour cette commande.", 409);
    console.error("Enregistrement de l'avis impossible", insertError.message);
    return error("Votre avis n'a pas pu être enregistré. Réessayez dans un instant.", 500);
  }

  revalidatePath(`/${slug}`);
  return NextResponse.json({ ok: true }, { status: 201 });
}
