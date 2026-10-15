import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin";
import { buildAdminContext } from "@/lib/admin-assistant-context";
import { askModel, assistantEnabled } from "@/lib/assistant-llm";
import { clearData, prepareTurn, readConversation, saveExchange, summarizeIfNeeded, type Owner } from "@/lib/assistant-memory";
import { createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

// Assistant de l'administrateur : aide à accompagner les vendeurs (priorités, messages à envoyer, idées d'annonces).
// Réservé aux emails de ADMIN_EMAILS. Il ne peut rien envoyer ni modifier lui-même : il propose, vous décidez.

const isLimited = createRateLimiter(20, 60_000); // 20 messages par minute

// `message` : la nouvelle question ; `messages` : l'historique vu par le navigateur (sert seulement si la mémoire du serveur est indisponible).
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
  if (!assistantEnabled()) return error("L'assistant n'est pas encore activé : ajoutez ASSISTANT_API_KEY dans Vercel.", 503);

  if (Number(request.headers.get("content-length") ?? 0) > 40_000) return error("Demande trop volumineuse.", 413);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("Message invalide.", 400);
  const last = parsed.data.messages?.[parsed.data.messages.length - 1];
  const question = parsed.data.message ?? (last?.role === "user" ? last.content : undefined);
  if (!question) return error("Message invalide.", 400);

  // Historique (enregistré côté serveur) et résumé des anciens échanges. Sans clé de service, l'assistant marche sans mémoire.
  const db = createAdminClient();
  const owner: Owner = { column: "admin_id", id: admin.id };
  const turn = await prepareTurn(db, owner, "le fondateur", question, parsed.data.messages);
  if (!turn.history) return error("Message invalide.", 400);

  const context = await buildAdminContext().catch((reason) => {
    console.error("Contexte de l'assistant admin indisponible", reason);
    return "Chiffres indisponibles pour le moment.";
  });

  const result = await askModel(`${SYSTEM_PROMPT}${turn.memory}\n\nChiffres de la plateforme (utilise-les pour conseiller) :\n${context}`, turn.history);
  if (!result.ok) return error(result.error, result.status);

  if (turn.persistent) {
    await saveExchange(db, owner, question, result.reply);
    after(() => summarizeIfNeeded(db, owner, "admin")); // résumé des anciens échanges : après la réponse, sans faire attendre
  }
  return NextResponse.json({ reply: result.reply, persistent: turn.persistent });
}

// Conversation enregistrée et mémoire (affichées à l'ouverture de la page).
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return error("Réservé à l'administrateur.", 403);
  const data = await readConversation(createAdminClient(), { column: "admin_id", id: admin.id });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

// Efface la conversation, la mémoire, ou les deux (?what=conversation | memory | all).
export async function DELETE(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return error("Réservé à l'administrateur.", 403);
  const what = request.nextUrl.searchParams.get("what");
  if (what !== "conversation" && what !== "memory" && what !== "all") return error("Demande invalide.", 400);
  const done = await clearData(createAdminClient(), { column: "admin_id", id: admin.id }, what);
  return done ? NextResponse.json({ ok: true }) : error("Suppression impossible pour le moment. Réessayez.", 503);
}
