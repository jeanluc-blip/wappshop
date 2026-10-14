"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
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

export function AssistantChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const recognition = useRef<RecognitionLike | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanListen(getRecognition() !== null);
    setCanSpeak("speechSynthesis" in window);
    return () => {
      recognition.current?.stop();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, sending]);

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
      if (transcript) setText((current) => (current ? `${current} ${transcript}` : transcript).slice(0, 1500));
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
    setTurns(next);
    setText("");
    setError(null);
    setSending(true);
    try {
      const response = await fetch("/api/assistant", {
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
      setTurns([...next, { role: "assistant", content: reply }]);
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

  return (
    <div>
      <ul aria-label="Conversation avec l'assistant" aria-live="polite" className="mb-3 flex max-h-[55dvh] min-h-40 flex-col gap-2 overflow-y-auto rounded-2xl bg-surface p-3">
        {turns.length === 0 && <li className="m-auto text-center text-sm text-muted">Choisissez une question ci-dessous, ou posez la vôtre.</li>}
        {turns.map((turn, index) => (
          <li key={index} className={cn("flex max-w-[88%] flex-col", turn.role === "user" ? "items-end self-end" : "items-start self-start")}>
            <p className={cn("whitespace-pre-line break-words rounded-2xl px-3 py-2 text-[15px]", turn.role === "user" ? "bg-brand text-on-brand" : "border border-border bg-background")}>
              {turn.content}
            </p>
          </li>
        ))}
        {sending && (
          <li role="status" className="self-start text-sm text-muted">
            L&apos;assistant réfléchit...
          </li>
        )}
        <div ref={endRef} />
      </ul>

      {turns.length === 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Questions proposées">
          {SUGGESTIONS.map((suggestion) => (
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
        {canSpeak ? (
          <label className="flex min-h-9 cursor-pointer items-center gap-2">
            <input type="checkbox" checked={speak} onChange={(event) => setSpeak(event.target.checked)} className="size-4" />
            <Volume2 size={16} aria-hidden="true" />
            Lire les réponses à voix haute
          </label>
        ) : (
          <span />
        )}
        {remaining !== null && <span className="text-xs text-muted">Il vous reste {remaining} message{remaining > 1 ? "s" : ""} aujourd&apos;hui</span>}
      </div>
    </div>
  );
}
