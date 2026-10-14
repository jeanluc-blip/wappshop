import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { askModel, cleanHistory } from "@/lib/assistant-llm";
import { buildSellerContext } from "@/lib/assistant-context";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { getShopContext } from "@/lib/shop";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Assistant de vente : répond aux questions du vendeur en s'appuyant sur les chiffres de SA boutique.
// Clé : ANTHROPIC_API_KEY (Vercel). Modèle : ASSISTANT_MODEL (par défaut claude-haiku-5-5). Limite par vendeur : ASSISTANT_DAILY_LIMIT (30/jour).

const isLimited = createRateLimiter(10, 60_000); // 10 messages par minute et par adresse IP

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1500) }))
    .min(1)
    .max(30),
});

const SYSTEM_PROMPT = `Tu es l'assistant de vente de WappShop. Tu aides un petit vendeur d'Afrique de l'Ouest (surtout au Bénin) à vendre plus avec sa boutique en ligne, où les clients commandent par WhatsApp.

Règles :
- Réponds toujours en français, en vouvoyant, avec des mots simples. Sois court : 150 mots maximum, avec 2 à 4 actions concrètes et faciles à faire dès aujourd'hui.
- Appuie-toi sur les chiffres de la boutique fournis ci-dessous. N'invente jamais de chiffre ni de fait ; si une donnée manque, dis-le.
- Propose en priorité les fonctions de WappShop : bouton Partager (image prête pour WhatsApp, Facebook, Instagram, TikTok), produits en vedette, prix barré et étiquette Promo, demande d'avis après livraison (onglet Commandes), affiche avec QR code, belles photos et descriptions, zones de livraison, numéro WhatsApp réel.
- Quand on te demande un texte (statut WhatsApp, légende, message à un client), écris-le prêt à copier, sans émojis.
- Ne promets jamais de résultat précis (« vous doublerez vos ventes »). Parle de ce qui augmente les chances de vendre.
- Tu ne peux modifier ni la boutique ni les commandes toi-même : explique comment le vendeur le fait.
- Pas de conseil médical, juridique ou financier détaillé. Pour un problème de compte ou un bug, invite à écrire à l'équipe dans l'onglet Messages.
- Reste sur la vente et la boutique ; décline poliment le reste.`;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const ctx = await getShopContext();
  if (!ctx) return error("Votre session a expiré. Reconnectez-vous.", 401);
  if (isLimited(`${clientIp(request)}:${ctx.user.id}`)) return error("Trop de messages en peu de temps. Patientez une minute.", 429);

  if (!process.env.ANTHROPIC_API_KEY) return error("L'assistant n'est pas encore activé. Il sera disponible très bientôt.", 503);

  if (Number(request.headers.get("content-length") ?? 0) > 40_000) return error("Demande trop volumineuse.", 413);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("Message invalide.", 400);

  // Historique récent : doit commencer et finir par un message du vendeur.
  const history = cleanHistory(parsed.data.messages);
  if (!history) return error("Message invalide.", 400);

  // Limite quotidienne par vendeur (protège le coût). Sans la table de suivi, on refuse plutôt que de laisser le coût sans plafond.
  const admin = createAdminClient();
  if (!admin) return error("L'assistant est momentanément indisponible.", 503);
  const limit = Math.max(1, Number(process.env.ASSISTANT_DAILY_LIMIT ?? 30) || 30);
  const day = new Date().toISOString().slice(0, 10);
  const usage = await admin.from("assistant_usage").select("count").eq("shop_id", ctx.shop.id).eq("day", day).maybeSingle();
  if (usage.error) {
    console.error("Suivi de l'assistant indisponible", usage.error.message);
    return error("L'assistant sera disponible très bientôt (mise à jour en cours).", 503);
  }
  const used = Number(usage.data?.count ?? 0);
  if (used >= limit) return error(`Vous avez atteint la limite de ${limit} messages pour aujourd'hui. Revenez demain, ou écrivez à l'équipe dans l'onglet Messages.`, 429);
  await admin.from("assistant_usage").upsert({ shop_id: ctx.shop.id, day, count: used + 1 }, { onConflict: "shop_id,day" });

  // Chiffres de la boutique du vendeur connecté (droits du vendeur : jamais les données d'un autre).
  const supabase = await createClient();
  const shopContext = await buildSellerContext(supabase, ctx.shop).catch((reason) => {
    console.error("Contexte assistant indisponible", reason);
    return `Boutique : ${ctx.shop.shop_name} (chiffres indisponibles pour le moment)`;
  });

  const result = await askModel(
    `${SYSTEM_PROMPT}\n\nChiffres de la boutique du vendeur (ne les montre pas en bloc, utilise-les pour conseiller) :\n${shopContext}`,
    history,
  );
  if (!result.ok) return error(result.error, result.status);
  const reply = result.reply;

  return NextResponse.json({ reply, remaining: Math.max(0, limit - used - 1) });
}
