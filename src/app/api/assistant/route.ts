import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { askModel, assistantEnabled } from "@/lib/assistant-llm";
import { clearData, prepareTurn, readConversation, saveExchange, summarizeIfNeeded, type Owner } from "@/lib/assistant-memory";
import { buildSellerContext } from "@/lib/assistant-context";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { getShopContext } from "@/lib/shop";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Assistant de vente : répond aux questions du vendeur en s'appuyant sur les chiffres de SA boutique.
// Fournisseur : ASSISTANT_API_KEY / ASSISTANT_BASE_URL / ASSISTANT_MODEL (ou ANTHROPIC_API_KEY), voir lib/assistant-llm.ts. Limite par vendeur : ASSISTANT_DAILY_LIMIT (30/jour).

const isLimited = createRateLimiter(10, 60_000); // 10 messages par minute et par adresse IP

// `message` : la nouvelle question ; `messages` : l'historique vu par le navigateur (sert seulement si la mémoire du serveur est indisponible).
// Les anciens navigateurs n'envoient que `messages` : la dernière entrée est alors la question.
const bodySchema = z
  .object({
    message: z.string().trim().min(1).max(1500).optional(),
    messages: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1500) }))
      .min(1)
      .max(30)
      .optional(),
  })
  .refine((body) => body.message !== undefined || body.messages !== undefined);

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

  if (!assistantEnabled()) return error("L'assistant n'est pas encore activé. Il sera disponible très bientôt.", 503);

  if (Number(request.headers.get("content-length") ?? 0) > 40_000) return error("Demande trop volumineuse.", 413);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("Message invalide.", 400);
  const last = parsed.data.messages?.[parsed.data.messages.length - 1];
  const question = parsed.data.message ?? (last?.role === "user" ? last.content : undefined);
  if (!question) return error("Message invalide.", 400);

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

  // Historique (enregistré côté serveur) et résumé des anciens échanges ; l'historique doit commencer et finir par un message du vendeur.
  const owner: Owner = { column: "shop_id", id: ctx.shop.id };
  const turn = await prepareTurn(admin, owner, "ce vendeur", question, parsed.data.messages);
  if (!turn.history) return error("Message invalide.", 400);

  // Chiffres de la boutique du vendeur connecté (droits du vendeur : jamais les données d'un autre).
  const supabase = await createClient();
  const shopContext = await buildSellerContext(supabase, ctx.shop).catch((reason) => {
    console.error("Contexte assistant indisponible", reason);
    return `Boutique : ${ctx.shop.shop_name} (chiffres indisponibles pour le moment)`;
  });

  const result = await askModel(
    `${SYSTEM_PROMPT}${turn.memory}\n\nChiffres de la boutique du vendeur (ne les montre pas en bloc, utilise-les pour conseiller) :\n${shopContext}`,
    turn.history,
  );
  if (!result.ok) return error(result.error, result.status);
  const reply = result.reply;

  if (turn.persistent) {
    await saveExchange(admin, owner, question, reply);
    after(() => summarizeIfNeeded(admin, owner, "seller")); // résumé des anciens échanges : après la réponse, sans faire attendre
  }
  return NextResponse.json({ reply, remaining: Math.max(0, limit - used - 1), persistent: turn.persistent });
}

// Conversation enregistrée et mémoire (affichées à l'ouverture de la page).
export async function GET() {
  const ctx = await getShopContext();
  if (!ctx) return error("Votre session a expiré. Reconnectez-vous.", 401);
  const data = await readConversation(createAdminClient(), { column: "shop_id", id: ctx.shop.id });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

// Efface la conversation, la mémoire, ou les deux (?what=conversation | memory | all).
export async function DELETE(request: NextRequest) {
  const ctx = await getShopContext();
  if (!ctx) return error("Votre session a expiré. Reconnectez-vous.", 401);
  const what = request.nextUrl.searchParams.get("what");
  if (what !== "conversation" && what !== "memory" && what !== "all") return error("Demande invalide.", 400);
  const done = await clearData(createAdminClient(), { column: "shop_id", id: ctx.shop.id }, what);
  return done ? NextResponse.json({ ok: true }) : error("Suppression impossible pour le moment. Réessayez.", 503);
}
