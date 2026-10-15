"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "assistant"; content: string };

const DEFAULT_SUGGESTIONS = [
  "Que faire cette semaine pour avoir plus de commandes ?",
  "Analyse mes statistiques et dis-moi quoi améliorer.",
  "Écris-moi un texte pour mon statut WhatsApp.",
  "Quels produits mettre en promotion ?",
  "Comment mieux photographier mes produits ?",
];

// Dictée vocale : fonction du navigateur (Chrome, Edge, Android ; Safari iPhone souvent absente). Types minimaux écrits à la main.
type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => RecognitionLike;

function getRecognition(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type AssistantChatProps = {
  /** Adresse serveur de l'assistant (vendeur par défaut). */
  endpoint?: string;
  suggestions?: string[];
  emptyText?: string;
  /** Identifiant du compte (boutique ou administrateur) : sépare les conversations de deux comptes sur un même appareil. */
  scope?: string;
};

// Ces capacités ne changent jamais pendant la visite : rien à écouter.
function subscribeNever() {
  return () => {};
}

// La conversation est gardée dans le navigateur de l'appareil (jamais sur nos serveurs) pour la retrouver en revenant sur la page.
const STORAGE_PREFIX = "wappshop-assistant:";
const STORAGE_EVENT = "wappshop-assistant-change";
const MAX_STORED_TURNS = 40;

function subscribeStorage(callback: () => void) {
  window.addEventListener(STORAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function readStored(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStored(key: string, turns: Turn[]) {
  try {
    if (turns.length > 0) window.localStorage.setItem(key, JSON.stringify(turns.slice(-MAX_STORED_TURNS)));
    else window.localStorage.removeItem(key);
  } catch {
    // Stockage refusé (navigation privée, plein) : la conversation reste visible tant que la page est ouverte.
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function parseTurns(raw: string): Turn[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((item): item is Turn => Boolean(item) && typeof item === "object" && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      .slice(-MAX_STORED_TURNS);
  } catch {
    return [];
  }
}

export function AssistantChat({ endpoint = "/api/assistant", suggestions = DEFAULT_SUGGESTIONS, emptyText = "Choisissez une question ci-dessous, ou posez la vôtre.", scope = "" }: AssistantChatProps) {
  const storageKey = `${STORAGE_PREFIX}${endpoint}:${scope}`;
  const storedRaw = useSyncExternalStore(subscribeStorage, () => readStored(storageKey), () => "");
  const turns = useMemo(() => parseTurns(storedRaw), [storedRaw]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  // Capacités du navigateur (micro, voix) : lues côté navigateur seulement, « false » pendant le rendu serveur.
  const canListen = useSyncExternalStore(subscribeNever, () => getRecognition() !== null, () => false);
  const canSpeak = useSyncExternalStore(subscribeNever, () => "speechSynthesis" in window, () => false);
  const recognition = useRef<RecognitionLike | null>(null);
  // Valeurs lues par la dictée au moment où elle se termine (la dictée dure plus longtemps qu'un rendu).
  const autoSendRef = useRef(false);
  const askRef = useRef<(question: string) => void>(() => {});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      recognition.current?.stop();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, sending]);

  useEffect(() => {
    autoSendRef.current = autoSend;
  }, [autoSend]);

  function toggleListening() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) return;
    const instance = new Ctor();
    instance.lang = "fr-FR";
    instance.interimResults = false;
    instance.continuous = false;
    instance.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (!transcript) return;
      // Mode vocal : la phrase dictée est envoyée tout de suite ; sinon elle est ajoutée à la zone de saisie.
      if (autoSendRef.current) askRef.current(transcript);
      else setText((current) => (current ? `${current} ${transcript}` : transcript).slice(0, 1500));
    };
    instance.onerror = () => setError("Le micro n'a pas pu démarrer. Vérifiez l'autorisation du micro dans votre navigateur.");
    instance.onend = () => setListening(false);
    recognition.current = instance;
    setError(null);
    setListening(true);
    try {
      instance.start();
    } catch {
      setListening(false);
    }
  }

  async function ask(question: string) {
    const content = question.trim();
    if (!content || sending) return;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const next: Turn[] = [...turns, { role: "user", content }];
    writeStored(storageKey, next);
    setText("");
    setError(null);
    setSending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok || !data || typeof data !== "object" || !("reply" in data) || typeof data.reply !== "string") {
        setError(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "L'assistant n'a pas pu répondre. Réessayez.");
        return;
      }
      const reply = data.reply;
      writeStored(storageKey, [...next, { role: "assistant", content: reply }]);
      if ("remaining" in data && typeof data.remaining === "number") setRemaining(data.remaining);
      if (speak && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.lang = "fr-FR";
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      setError("Envoi impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    askRef.current = ask;
  });

  async function copyReply(content: string) {
    if (await copyText(content)) toast.success("Texte copié");
    else window.prompt("Copiez ce texte :", content);
  }

  return (
    <div>
      <ul aria-label="Conversation avec l'assistant" aria-live="polite" className="mb-3 flex max-h-[55dvh] min-h-40 flex-col gap-2 overflow-y-auto rounded-2xl bg-surface p-3">
        {turns.length === 0 && <li className="m-auto text-center text-sm text-muted">{emptyText}</li>}
        {turns.map((turn, index) => (
          <li key={index} className={cn("flex max-w-[88%] flex-col", turn.role === "user" ? "items-end self-end" : "items-start self-start")}>
            <p className={cn("whitespace-pre-line break-words rounded-2xl px-3 py-2 text-[15px]", turn.role === "user" ? "bg-brand text-on-brand" : "border border-border bg-background")}>
              {turn.content}
            </p>
            {turn.role === "assistant" && (
              <button type="button" onClick={() => copyReply(turn.content)} className="mt-0.5 min-h-8 cursor-pointer rounded-lg px-2 text-xs text-muted underline-offset-2 hover:underline">
                Copier
              </button>
            )}
          </li>
        ))}
        {sending && (
          <li role="status" className="self-start text-sm text-muted">
            L&apos;assistant réfléchit...
          </li>
        )}
        <div ref={endRef} />
      </ul>

      {turns.length > 0 && (
        <div className="-mt-1 mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Effacer cette conversation de cet appareil ?")) writeStored(storageKey, []);
            }}
            className="min-h-8 cursor-pointer rounded-lg px-2 text-xs text-muted underline-offset-2 hover:underline"
          >
            Effacer la conversation
          </button>
        </div>
      )}

      {turns.length === 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Questions proposées">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => ask(suggestion)}
              disabled={sending}
              className="min-h-9 cursor-pointer rounded-full border border-border bg-background px-3 text-left text-xs hover:bg-surface disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mb-2 rounded-xl border border-border bg-surface p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(text);
        }}
      >
        <label htmlFor="assistant-input" className="sr-only">
          Votre question
        </label>
        <Textarea
          id="assistant-input"
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, 1500))}
          maxLength={1500}
          placeholder={listening ? "Je vous écoute..." : "Posez votre question..."}
          className="min-h-20"
        />
        <div className="mt-2 flex items-center gap-2">
          {canListen && (
            <Button type="button" variant={listening ? "default" : "outline"} onClick={toggleListening} aria-pressed={listening} aria-label={listening ? "Arrêter la dictée" : "Dicter ma question"}>
              {listening ? <Square size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
              {listening ? "Arrêter" : "Dicter"}
            </Button>
          )}
          <span className="flex-1" />
          <Button type="submit" disabled={sending || text.trim() === ""}>
            Envoyer
          </Button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex flex-col">
          {canSpeak && (
            <label className="flex min-h-9 cursor-pointer items-center gap-2">
              <input type="checkbox" checked={speak} onChange={(event) => setSpeak(event.target.checked)} className="size-4" />
              <Volume2 size={16} aria-hidden="true" />
              Lire les réponses à voix haute
            </label>
          )}
          {canListen && (
            <label className="flex min-h-9 cursor-pointer items-center gap-2">
              <input type="checkbox" checked={autoSend} onChange={(event) => setAutoSend(event.target.checked)} className="size-4" />
              <Mic size={16} aria-hidden="true" />
              Envoyer ma dictée automatiquement
            </label>
          )}
        </div>
        {remaining !== null && <span className="text-xs text-muted">Il vous reste {remaining} message{remaining > 1 ? "s" : ""} aujourd&apos;hui</span>}
      </div>
    </div>
  );
}
