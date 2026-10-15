import "server-only";
import { askModel, cleanHistory, type Turn } from "@/lib/assistant-llm";
import type { createAdminClient } from "@/lib/supabase/admin";

// Mémoire des assistants (vendeur et administrateur) :
//  - la conversation est enregistrée côté serveur (table assistant_messages) : on la retrouve sur tous les appareils ;
//  - les anciens échanges sont résumés automatiquement (table assistant_memory) : l'assistant garde l'essentiel sans relire tout.
// Tout passe par la clé de service : ni les vendeurs ni l'administrateur ne lisent ces tables directement.
// Sans les tables (phase11.sql pas encore lancé), tout est ignoré en silence et l'assistant fonctionne sans mémoire.

type Db = NonNullable<ReturnType<typeof createAdminClient>>;
export type Owner = { column: "shop_id" | "admin_id"; id: string };
type Row = { id: number; role: "user" | "assistant"; content: string };

export const WINDOW = 12; // derniers messages relus par le modèle à chaque question (même valeur que cleanHistory)
export const DISPLAY = 40; // derniers messages conservés et affichés
const SUMMARIZE_FROM = 10; // messages sortis de la fenêtre avant de lancer un résumé
const SUMMARIZE_BATCH = 30; // messages résumés d'un coup, au maximum
const SUMMARY_MAX = 1500; // taille maximale du résumé (caractères)

function isRow(value: unknown): value is Row {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "number" && (row.role === "user" || row.role === "assistant") && typeof row.content === "string";
}

/** Derniers messages, du plus ancien au plus récent ; null si la table est indisponible. */
async function loadRecent(db: Db, owner: Owner, limit: number): Promise<Row[] | null> {
  const { data, error } = await db.from("assistant_messages").select("id, role, content").eq(owner.column, owner.id).order("id", { ascending: false }).limit(limit);
  if (error || !Array.isArray(data)) {
    if (error) console.error("Mémoire de l'assistant indisponible (messages)", error.message);
    return null;
  }
  return data.filter(isRow).reverse();
}

async function loadMemory(db: Db, owner: Owner): Promise<{ summary: string; through: number } | null> {
  const { data, error } = await db.from("assistant_memory").select("summary, summarized_through").eq(owner.column, owner.id).maybeSingle();
  if (error) {
    console.error("Mémoire de l'assistant indisponible (résumé)", error.message);
    return null;
  }
  return { summary: typeof data?.summary === "string" ? data.summary : "", through: Number(data?.summarized_through ?? 0) };
}

/** Phrase ajoutée au contexte du modèle quand un résumé existe. */
function memoryBlock(summary: string, who: string): string {
  return summary ? `\n\nMémoire de vos échanges précédents avec ${who} (résumé automatique : utilisez-le pour être cohérent, sans le réciter ni dire que vous avez une mémoire) :\n${summary}` : "";
}

/**
 * Prépare une question : historique à envoyer au modèle et mémoire.
 * Si la base est indisponible, on se rabat sur l'historique envoyé par le navigateur (l'assistant marche, sans mémoire durable).
 */
export async function prepareTurn(
  db: Db | null,
  owner: Owner,
  who: string,
  question: string,
  clientMessages: Turn[] | undefined,
): Promise<{ history: Turn[] | null; memory: string; persistent: boolean }> {
  const fallback = () => ({ history: cleanHistory([...(clientMessages ?? []).slice(0, -1), { role: "user" as const, content: question }]), memory: "", persistent: false });
  if (!db) return fallback();
  const [recent, memory] = await Promise.all([loadRecent(db, owner, WINDOW), loadMemory(db, owner)]);
  if (!recent || !memory) return fallback();
  const turns: Turn[] = [...recent.map(({ role, content }) => ({ role, content })), { role: "user", content: question }];
  return { history: cleanHistory(turns), memory: memoryBlock(memory.summary, who), persistent: true };
}

/** Enregistre la question et la réponse. Renvoie false si l'enregistrement a échoué (sans gêner l'utilisateur). */
export async function saveExchange(db: Db | null, owner: Owner, question: string, reply: string): Promise<boolean> {
  if (!db) return false;
  const { error } = await db.from("assistant_messages").insert([
    { [owner.column]: owner.id, role: "user", content: question.slice(0, 6000) },
    { [owner.column]: owner.id, role: "assistant", content: reply.slice(0, 6000) },
  ]);
  if (error) console.error("Enregistrement de la conversation impossible", error.message);
  return !error;
}

const SUMMARY_SYSTEM = {
  seller:
    "Tu tiens à jour la mémoire d'un assistant de vente qui conseille un petit vendeur. On te donne le résumé actuel et de nouveaux échanges. Écris le résumé mis à jour.\n" +
    "À garder, seulement si c'est utile plus tard : ce que vend la boutique, les objectifs et contraintes du vendeur, les décisions prises, les idées déjà proposées ou essayées et leur résultat, ses préférences de style.",
  admin:
    "Tu tiens à jour la mémoire d'un conseiller qui aide le fondateur d'une plateforme à accompagner ses vendeurs. On te donne le résumé actuel et de nouveaux échanges. Écris le résumé mis à jour.\n" +
    "À garder, seulement si c'est utile plus tard : les vendeurs suivis (par nom de boutique), les actions décidées ou faites, les annonces préparées, les priorités et préférences du fondateur.",
};

/**
 * Résume les anciens messages quand il y en a assez, puis supprime les très anciens (déjà résumés).
 * À lancer après la réponse (next/server `after`) : l'utilisateur n'attend pas.
 */
export async function summarizeIfNeeded(db: Db | null, owner: Owner, kind: "seller" | "admin"): Promise<void> {
  if (!db) return;
  const memory = await loadMemory(db, owner);
  if (!memory) return;

  const { data, error } = await db
    .from("assistant_messages")
    .select("id, role, content")
    .eq(owner.column, owner.id)
    .gt("id", memory.through)
    .order("id", { ascending: true })
    .limit(200);
  if (error || !Array.isArray(data)) return;
  const pending = data.filter(isRow);
  const outOfWindow = pending.slice(0, Math.max(0, pending.length - WINDOW));
  if (outOfWindow.length < SUMMARIZE_FROM) return;
  const batch = outOfWindow.slice(0, SUMMARIZE_BATCH);

  const transcript = batch.map((row) => `${row.role === "user" ? "Utilisateur" : "Assistant"} : ${row.content.slice(0, 600)}`).join("\n");
  const prompt =
    `Résumé actuel :\n${memory.summary || "(aucun)"}\n\nNouveaux échanges :\n${transcript}\n\n` +
    "Écris le résumé mis à jour : 10 lignes maximum (1200 caractères maximum), en français, sous forme de tirets simples. " +
    "N'écris ni nom, ni téléphone, ni adresse, ni email de client. N'invente rien. Réponds uniquement par le résumé.";
  const result = await askModel(SUMMARY_SYSTEM[kind], [{ role: "user", content: prompt }]);
  if (!result.ok) return;
  const summary = result.reply.trim().slice(0, SUMMARY_MAX);
  if (!summary) return;

  const through = batch[batch.length - 1].id;
  const saved = await db.from("assistant_memory").upsert({ [owner.column]: owner.id, summary, summarized_through: through, updated_at: new Date().toISOString() }, { onConflict: owner.column });
  if (saved.error) {
    console.error("Enregistrement de la mémoire impossible", saved.error.message);
    return;
  }

  // On ne garde que les DISPLAY derniers messages ; les plus anciens sont déjà dans le résumé.
  const edge = await db.from("assistant_messages").select("id").eq(owner.column, owner.id).order("id", { ascending: false }).range(DISPLAY, DISPLAY);
  const cutoff = Array.isArray(edge.data) && edge.data.length > 0 ? Number((edge.data[0] as { id: number }).id) : 0;
  const prune = Math.min(cutoff, through);
  if (prune > 0) await db.from("assistant_messages").delete().eq(owner.column, owner.id).lte("id", prune);
}

/** Conversation affichée à l'écran et résumé retenu. */
export async function readConversation(db: Db | null, owner: Owner): Promise<{ messages: Turn[]; memory: string; persistent: boolean }> {
  if (!db) return { messages: [], memory: "", persistent: false };
  const [recent, memory] = await Promise.all([loadRecent(db, owner, DISPLAY), loadMemory(db, owner)]);
  if (!recent || !memory) return { messages: [], memory: "", persistent: false };
  return { messages: recent.map(({ role, content }) => ({ role, content })), memory: memory.summary, persistent: true };
}

/** Efface la conversation, la mémoire, ou les deux. */
export async function clearData(db: Db | null, owner: Owner, what: "conversation" | "memory" | "all"): Promise<boolean> {
  if (!db) return false;
  let ok = true;
  if (what !== "memory") {
    const { error } = await db.from("assistant_messages").delete().eq(owner.column, owner.id);
    if (error) ok = false;
  }
  if (what === "all") {
    const { error } = await db.from("assistant_memory").delete().eq(owner.column, owner.id);
    if (error) ok = false;
  } else if (what === "memory") {
    // Oublier : on vide le résumé ET on marque les messages existants comme « déjà vus », sinon le résumé se reconstruirait
    // au prochain message à partir des anciens échanges encore enregistrés.
    const latest = await db.from("assistant_messages").select("id").eq(owner.column, owner.id).order("id", { ascending: false }).limit(1);
    const lastId = Array.isArray(latest.data) && latest.data.length > 0 ? Number((latest.data[0] as { id: number }).id) : 0;
    const { error } = lastId > 0
      ? await db.from("assistant_memory").upsert({ [owner.column]: owner.id, summary: "", summarized_through: lastId, updated_at: new Date().toISOString() }, { onConflict: owner.column })
      : await db.from("assistant_memory").delete().eq(owner.column, owner.id);
    if (error) ok = false;
  }
  return ok;
}
