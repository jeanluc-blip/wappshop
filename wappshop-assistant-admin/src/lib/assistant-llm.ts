import "server-only";

// Appel commun aux deux assistants (vendeur et administrateur) vers l'API Anthropic.
// Clé : ANTHROPIC_API_KEY. Modèle : ASSISTANT_MODEL (par défaut claude-haiku-5-5).

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-5-5";

export type Turn = { role: "user" | "assistant"; content: string };
export type LlmResult = { ok: true; reply: string } | { ok: false; status: number; error: string };

/** Garde au plus 12 tours, en commençant et finissant par un message de l'utilisateur. */
export function cleanHistory(messages: Turn[]): Turn[] | null {
  let history = messages.slice(-12);
  while (history.length > 0 && history[0].role !== "user") history = history.slice(1);
  if (history.length === 0 || history[history.length - 1].role !== "user") return null;
  return history;
}

export async function askModel(system: string, history: Turn[]): Promise<LlmResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, status: 503, error: "L'assistant n'est pas encore activé. Il sera disponible très bientôt." };

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ASSISTANT_MODEL || DEFAULT_MODEL, max_tokens: 800, system, messages: history }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (reason) {
    console.error("Appel de l'assistant impossible", reason);
    return { ok: false, status: 502, error: "L'assistant est momentanément indisponible. Réessayez dans un instant." };
  }

  if (!response.ok) {
    // Le détail (clé invalide, modèle inconnu, crédit épuisé...) reste dans les journaux Vercel.
    console.error("Réponse de l'API de l'assistant", response.status, (await response.text().catch(() => "")).slice(0, 400));
    return { ok: false, status: 502, error: "L'assistant est momentanément indisponible. Réessayez dans un instant." };
  }

  const data: unknown = await response.json().catch(() => null);
  const blocks = data && typeof data === "object" && "content" in data && Array.isArray(data.content) ? (data.content as { type?: string; text?: string }[]) : [];
  const reply = blocks
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!reply) return { ok: false, status: 502, error: "L'assistant n'a pas pu répondre. Reformulez votre question." };
  return { ok: true, reply };
}
