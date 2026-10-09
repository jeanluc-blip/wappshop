"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAX_COMMENT = 300;
const LABELS = ["Très décevant", "Décevant", "Correct", "Bien", "Excellent"];

/** Formulaire d'avis : note de 1 à 5 étoiles et commentaire facultatif (300 caractères). */
export function ReviewForm({ slug, token, shopName }: { slug: string; token: string; shopName: string }) {
  const id = useId();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    if (rating < 1) {
      setError("Choisissez une note de 1 à 5 étoiles.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, token, rating, comment: comment.trim() || undefined }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Votre avis n'a pas pu être envoyé. Réessayez.");
        return;
      }
      setDone(true);
    } catch {
      setError("Votre avis n'a pas pu être envoyé. Vérifiez votre connexion et réessayez.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="text-center">
        <p className="text-lg font-bold">Merci pour votre avis !</p>
        <p className="mt-1 text-muted">Il aide {shopName} et les prochains clients.</p>
        <Button asChild variant="outline" className="mt-5">
          <Link href={`/${slug}`}>Voir la boutique</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <p id={`${id}-legend`} className="mb-2 text-center text-sm text-muted">
        Votre note
      </p>
      <div role="radiogroup" aria-labelledby={`${id}-legend`} className="mb-1 flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} sur 5 : ${LABELS[value - 1]}`}
            onClick={() => setRating(value)}
            className="grid h-12 w-12 cursor-pointer place-items-center rounded-full hover:bg-surface"
          >
            <Star size={32} aria-hidden="true" className={cn(value <= rating ? "fill-[#f59e0b] text-[#f59e0b]" : "text-border")} />
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mb-4 h-5 text-center text-sm font-semibold">
        {rating > 0 ? LABELS[rating - 1] : ""}
      </p>

      <Label htmlFor={`${id}-comment`}>Commentaire (facultatif)</Label>
      <Textarea
        id={`${id}-comment`}
        value={comment}
        onChange={(event) => setComment(event.target.value.slice(0, MAX_COMMENT))}
        maxLength={MAX_COMMENT}
        placeholder="Dites-nous ce que vous avez pensé de votre commande"
      />
      <p className="mb-3 mt-1 text-right text-xs text-muted">
        {comment.length}/{MAX_COMMENT}
      </p>

      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-border bg-surface p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="full" disabled={sending}>
        {sending ? "Envoi en cours..." : "Envoyer mon avis"}
      </Button>
    </form>
  );
}
