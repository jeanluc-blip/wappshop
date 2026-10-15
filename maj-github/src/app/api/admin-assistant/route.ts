import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin";
import { buildAdminContext } from "@/lib/admin-assistant-context";
import { askModel, cleanHistory } from "@/lib/assistant-llm";
import { createRateLimiter } from "@/lib/rate-limit";

// Assistant de l'administrateur : aide à accompagner les vendeurs (priorités, messages à envoyer, idées d'annonces).
// Réservé aux emails de ADMIN_EMAILS. Il ne peut rien envoyer ni modifier lui-même : il propose, vous décidez.

const isLimited = createRateLimiter(20, 60_000); // 20 messages par minute

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1500) }))
    .min(1)
    .max(30),
});

const SYSTEM_PROMPT = `Tu es le conseiller du fondateur de WappShop, une plateforme qui permet à de petits vendeurs d'Afrique de l'Ouest (surtout au Bénin) d'avoir une boutique en ligne avec commandes par WhatsApp. Le fondateur t'utilise pour accompagner ses vendeurs et les aider à vendre plus.

Règles :
- Réponds en français, de façon claire et directe, avec des phrases courtes. Sois bref : 200 mots maximum, sauf si on te demande un texte plus long.
- Appuie-toi sur les chiffres de la plateforme fournis ci-dessous. N'invente jamais de chiffre, de vendeur ou de fait ; si une donnée manque, dis-le.
- Aide à prioriser (qui contacter en premier et pourquoi), à préparer des conversations et à planifier la semaine.
- Quand on te demande un message pour un vendeur ou une annonce, écris-le prêt à copier : court, chaleureux, en vouvoyant, sans émojis, avec une seule action claire à faire. Le fondateur l'envoie lui-même depuis la fiche du vendeur ou la page Annonce.
- Les fonctions à recommander aux vendeurs : bouton Partager (image prête pour WhatsApp, Facebook, Instagram, TikTok), produits en vedette, prix barré et étiquette Promo, demande d'avis après livraison, affiche avec QR code, belles photos et descriptions, zones de livraison, vrai numéro WhatsApp.
- Tu ne peux rien envoyer ni modifier toi-même : dis comment faire (fiche du vendeur > Conversation, ou page Annonce).
- Ne promets jamais de résultat précis. Pas de conseil juridique ou financier détaillé.`;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return error("Réservé à l'administrateur.", 403);
  if (isLimited(admin.id)) return error("Trop de messages en peu de temps. Patientez une minute.", 429);
  if (!process.env.ANTHROPIC_API_KEY) return error("L'assistant n'est pas encore activé : ajoutez ANTHROPIC_API_KEY dans Vercel.", 503);

  if (Number(request.headers.get("content-length") ?? 0) > 40_000) return error("Demande trop volumineuse.", 413);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("Message invalide.", 400);
  const history = cleanHistory(parsed.data.messages);
  if (!history) return error("Message invalide.", 400);

  const context = await buildAdminContext().catch((reason) => {
    console.error("Contexte de l'assistant admin indisponible", reason);
    return "Chiffres indisponibles pour le moment.";
  });

  const result = await askModel(`${SYSTEM_PROMPT}\n\nChiffres de la plateforme (utilise-les pour conseiller) :\n${context}`, history);
  if (!result.ok) return error(result.error, result.status);
  return NextResponse.json({ reply: result.reply });
}
