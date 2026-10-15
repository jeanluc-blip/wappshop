"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import type { ChatMessage } from "@/lib/admin-data";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 2000;
const timeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Porto-Novo" });

type ChatThreadProps = {
  messages: ChatMessage[];
  /** Qui regarde la conversation : ses messages s'affichent à droite. */
  viewer: "admin" | "seller";
  onSend: (body: string) => Promise<ActionResult>;
  /** Phrases toutes prêtes à insérer dans la zone de saisie (idées, conseils...). */
  suggestions?: string[];
  placeholder?: string;
  emptyText: string;
};

/** Conversation commune à l'administrateur et au vendeur. Se met à jour toute seule toutes les 20 secondes. */
export function ChatThread({ messages, viewer, onSend, suggestions = [], placeholder, emptyText }: ChatThreadProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id;

  // Défilement vers le dernier message quand un nouveau arrive.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  // Actualisation automatique, seulement quand la page est visible.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20_000);
    return () => clearInterval(timer);
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const result = await onSend(body);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setText("");
      router.refresh();
    } catch {
      toast.error("Envoi impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <ul aria-label="Messages" aria-live="polite" className="mb-3 flex max-h-[55dvh] min-h-40 flex-col gap-2 overflow-y-auto rounded-2xl bg-surface p-3">
        {messages.length === 0 && <li className="m-auto text-center text-sm text-muted">{emptyText}</li>}
        {messages.map((message) => {
          const mine = message.sender === viewer;
          return (
            <li key={message.id} className={cn("flex max-w-[85%] flex-col", mine ? "items-end self-end" : "items-start self-start")}>
              {message.kind === "announcement" && <span className="mb-0.5 text-xs font-semibold text-muted">Annonce</span>}
              <p
                className={cn(
                  "whitespace-pre-line break-words rounded-2xl px-3 py-2 text-[15px]",
                  mine ? "bg-brand text-on-brand" : "border border-border bg-background",
                )}
              >
                {message.body}
              </p>
              <span className="mt-0.5 text-xs text-muted">
                {message.sender === "admin" ? "Équipe WappShop" : "Vendeur"} · {timeFormat.format(new Date(message.createdAt))}
              </span>
            </li>
          );
        })}
        <div ref={endRef} />
      </ul>

      {suggestions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Idées de messages">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setText((current) => (current ? `${current}\n${suggestion}` : suggestion).slice(0, MAX_LENGTH))}
              className="min-h-9 cursor-pointer rounded-full border border-border bg-background px-3 text-left text-xs hover:bg-surface"
            >
              {suggestion.length > 48 ? `${suggestion.slice(0, 46)}...` : suggestion}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit}>
        <label htmlFor="chat-input" className="sr-only">
          Votre message
        </label>
        <Textarea
          id="chat-input"
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_LENGTH))}
          placeholder={placeholder ?? "Écrivez votre message..."}
          maxLength={MAX_LENGTH}
          className="min-h-20"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-muted">
            {text.length}/{MAX_LENGTH}
          </span>
          <Button type="submit" disabled={sending || text.trim() === ""}>
            {sending ? "Envoi..." : "Envoyer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
