import "server-only";

// Appel commun aux deux assistants (vendeur et administrateur). Deux façons de le brancher :
//  1) Fournisseur « compatible OpenAI » (Gemini, Groq, OpenRouter... y compris leurs offres gratuites) :
//     ASSISTANT_API_KEY (clé), ASSISTANT_BASE_URL (adresse du fournisseur), ASSISTANT_MODEL (nom du modèle).
//  2) Anthropic : ANTHROPIC_API_KEY (payant à l'usage), ASSISTANT_MODEL facultatif.
// Si les deux clés existent, ASSISTANT_API_KEY est utilisée.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_DEFAULT_MODEL = "claude-haiku-5-5";
// Par défaut : Gemini (Google AI Studio, offre gratuite limitée). Les noms de modèles changent : voir ASSISTANT_MODEL.
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_COMPAT_MODEL = "gemini-2.5-flash-lite";

/** Vrai si un fournisseur est configuré (sinon les pages affichent « bientôt disponible »). */
export function assistantEnabled(): boolean {
  return Boolean(process.env.ASSISTANT_API_KEY || process.env.ANTHROPIC_API_KEY);
}

export type Turn = { role: "user" | "assistant"; content: string };
export type LlmResult = { ok: true; reply: string } | { ok: false; status: number; error: string };

/** Garde au plus 12 tours, en commençant et finissant par un message de l'utilisateur. */
export function cleanHistory(messages: Turn[]): Turn[] | null {
  let history = messages.slice(-12);
  while (history.length > 0 && history[0].role !== "user") history = history.slice(1);
  if (history.length === 0 || history[history.length - 1].role !== "user") return null;
  return history;
}

const UNAVAILABLE = "L'assistant est momentanément indisponible. Réessayez dans un instant.";

async function callFetch(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  } catch (reason) {
    console.error("Appel de l'assistant impossible", reason);
    return null;
  }
}

async function failed(response: Response): Promise<LlmResult> {
  // Le détail (clé invalide, modèle inconnu, limite gratuite atteinte...) reste dans les journaux Vercel.
  console.error("Réponse de l'API de l'assistant", response.status, (await response.text().catch(() => "")).slice(0, 400));
  const message = response.status === 429 ? "L'assistant est très sollicité en ce moment. Réessayez dans une minute." : UNAVAILABLE;
  return { ok: false, status: 502, error: message };
}

function done(reply: string): LlmResult {
  return reply ? { ok: true, reply } : { ok: false, status: 502, error: "L'assistant n'a pas pu répondre. Reformulez votre question." };
}

export async function askModel(system: string, history: Turn[]): Promise<LlmResult> {
  const compatKey = process.env.ASSISTANT_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!compatKey && !anthropicKey) return { ok: false, status: 503, error: "L'assistant n'est pas encore activé. Il sera disponible très bientôt." };

  if (compatKey) {
    const base = (process.env.ASSISTANT_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
    const response = await callFetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${compatKey}` },
      body: JSON.stringify({
        model: process.env.ASSISTANT_MODEL || DEFAULT_COMPAT_MODEL,
        max_tokens: 800,
        messages: [{ role: "system", content: system }, ...history],
      }),
    });
    if (!response) return { ok: false, status: 502, error: UNAVAILABLE };
    if (!response.ok) return failed(response);
    const data: unknown = await response.json().catch(() => null);
    const choices = data && typeof data === "object" && "choices" in data && Array.isArray(data.choices) ? (data.choices as { message?: { content?: unknown } }[]) : [];
    const content = choices[0]?.message?.content;
    return done(typeof content === "string" ? content.trim() : "");
  }

  const response = await callFetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": anthropicKey as string, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.ASSISTANT_MODEL || ANTHROPIC_DEFAULT_MODEL, max_tokens: 800, system, messages: history }),
  });
  if (!response) return { ok: false, status: 502, error: UNAVAILABLE };
  if (!response.ok) return failed(response);
  const data: unknown = await response.json().catch(() => null);
  const blocks = data && typeof data === "object" && "content" in data && Array.isArray(data.content) ? (data.content as { type?: string; text?: string }[]) : [];
  return done(
    blocks
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("\n")
      .trim(),
  );
}
