"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImage, ImageError } from "@/lib/image";

/** Photo d'un produit : déjà enregistrée (adresse publique) ou nouvelle (à envoyer à l'enregistrement). */
export type PhotoItem =
  | { id: string; kind: "saved"; url: string }
  | { id: string; kind: "new"; blob: Blob; ext: "webp" | "jpg"; previewUrl: string };

type PhotoManagerProps = {
  value: PhotoItem[];
  onChange: (next: PhotoItem[]) => void;
  max?: number;
  disabled?: boolean;
};

const src = (item: PhotoItem) => (item.kind === "saved" ? item.url : item.previewUrl);

/**
 * Photos multiples d'un produit : import (iOS Safari et Android Chrome), aperçu, suppression, réorganisation.
 * Le bouton est un vrai <button type="button"> (≥ 44 px) qui appelle input.click() directement dans le clic ;
 * l'<input type="file"> est masqué par sr-only (pas display:none) et remis à zéro après chaque choix.
 */
export function PhotoManager({ value, onChange, max = 8, disabled = false }: PhotoManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  // Libère les aperçus locaux à la fermeture du composant.
  useEffect(() => {
    return () => {
      for (const item of latest.current) if (item.kind === "new") URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // permet de re-sélectionner le même fichier
    if (files.length === 0) return;

    const room = Math.max(0, max - value.length);
    if (room === 0) {
      toast.error(`${max} photos maximum par produit.`);
      return;
    }
    if (files.length > room) toast.message(`Seules ${room} photo(s) de plus sont acceptées.`);

    const selected = files.slice(0, room);
    const added: PhotoItem[] = [];
    setProgress({ done: 0, total: selected.length });
    for (const [index, file] of selected.entries()) {
      try {
        const { blob, ext } = await compressImage(file, 1200, 0.8);
        added.push({ id: crypto.randomUUID(), kind: "new", blob, ext, previewUrl: URL.createObjectURL(blob) });
      } catch (error) {
        toast.error(error instanceof ImageError ? error.message : `La photo « ${file.name} » n'a pas pu être lue.`);
      }
      setProgress({ done: index + 1, total: selected.length });
    }
    setProgress(null);
    // `latest` : la liste a pu changer pendant la préparation (suppression, déplacement).
    if (added.length > 0) onChange([...latest.current, ...added].slice(0, max));
  }

  function remove(id: string) {
    const target = value.find((item) => item.id === id);
    if (target?.kind === "new") URL.revokeObjectURL(target.previewUrl);
    onChange(value.filter((item) => item.id !== id));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  const busy = progress !== null;

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-3 grid grid-cols-3 gap-2" aria-label="Photos du produit">
          {value.map((item, index) => (
            <li key={item.id} className="min-w-0">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) ou miniature déjà optimisée */}
                <img src={src(item)} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                {index === 0 && (
                  <span className="absolute left-1 top-1 rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] font-semibold text-white">
                    Principale
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  disabled={disabled}
                  aria-label={`Supprimer la photo ${index + 1}`}
                  className="absolute right-1 top-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-black/65 text-white disabled:opacity-50"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="mt-1 flex justify-between gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9 flex-1 px-0"
                  disabled={disabled || index === 0}
                  aria-label={`Déplacer la photo ${index + 1} vers la gauche`}
                  onClick={() => move(index, -1)}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9 flex-1 px-0"
                  disabled={disabled || index === value.length - 1}
                  aria-label={`Déplacer la photo ${index + 1} vers la droite`}
                  onClick={() => move(index, 1)}
                >
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="full"
        disabled={disabled || busy || value.length >= max}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus size={18} aria-hidden="true" />
        {busy ? `Préparation ${progress.done}/${progress.total}…` : value.length > 0 ? "Ajouter d'autres photos" : "Ajouter des photos"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <p className="mt-2 text-sm text-muted">
        {value.length}/{max} photos. La première est l&apos;image principale ; utilisez les flèches pour changer l&apos;ordre.
      </p>
    </div>
  );
}
