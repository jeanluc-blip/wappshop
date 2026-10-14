import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/orders";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { looksLikeSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

// Statistiques anonymes par produit : « produit consulté » et « ajouté au panier ».
// Aucun cookie, aucune donnée personnelle : seulement l'identifiant du produit et l'identifiant de session aléatoire.

const bodySchema = z.object({
  slug: z.string().refine(looksLikeSlug),
  sessionId: z.string().regex(/^[A-Za-z0-9-]{16,64}$/),
  type: z.enum(["product_view", "add_to_cart"]),
  productId: z.string().regex(UUID_PATTERN),
});

const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|httpclient/i;
const isLimited = createRateLimiter(120, 60_000);
const DEDUPE_MINUTES = 30;
const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  if (BOT_PATTERN.test(request.headers.get("user-agent") ?? "")) return noContent();
  if (isLimited(clientIp(request))) return new NextResponse(null, { status: 429 });
  if (Number(request.headers.get("content-length") ?? 0) > 1024) return new NextResponse(null, { status: 413 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const { slug, sessionId, type, productId } = parsed.data;

  const admin = createAdminClient();
  if (!admin) return noContent();

  const { data: shop } = await admin.from("shops").select("id, user_id").eq("slug", slug).maybeSingle();
  if (!shop) return noContent();

  // Le propriétaire qui consulte sa propre boutique n'est pas un visiteur.
  const user = await getCurrentUser();
  if (user?.id === shop.user_id) return noContent();

  // Le produit doit appartenir à CETTE boutique.
  const { data: product } = await admin.from("products").select("id").eq("id", productId).eq("shop_id", shop.id).maybeSingle();
  if (!product) return noContent();

  // Une consultation du même produit par la même session n'est comptée qu'une fois par période.
  if (type === "product_view") {
    const since = new Date(Date.now() - DEDUPE_MINUTES * 60_000).toISOString();
    const { data: recent } = await admin
      .from("events")
      .select("id")
      .eq("shop_id", shop.id)
      .eq("type", "product_view")
      .eq("session_id", sessionId)
      .eq("product_id", productId)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) return noContent();
  }

  // Tant que supabase/phase8.sql n'est pas lancé, l'insertion échoue : on ignore sans bruit (aucun impact sur la boutique).
  const { error } = await admin.from("events").insert({ shop_id: shop.id, type, session_id: sessionId, product_id: productId });
  if (error && error.code !== "42703" && error.code !== "22P02") console.error("Enregistrement de l'événement impossible", error.message);
  return noContent();
}
