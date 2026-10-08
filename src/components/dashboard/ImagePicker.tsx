"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImage, ImageError } from "@/lib/image";

export type PickedImage = { id: string; blob: Blob; ext: "webp" | "jpg"; previewUrl: string };

type ImagePickerProps = {
  value: PickedImage[];
  onChange: (next: PickedImage[]) => void;
  multiple?: boolean;
  max?: number;
  maxSide?: number;
  label: string;
};

/**
 * Import de photos compatible iOS Safari et Android Chrome :
 * - vrai <button type="button"> (≥ 44 px) qui appelle input.click() directement dans le clic,
 * - <input type="file"> masqué avec sr-only (et non display:none),
 * - input.value remis à "" pour pouvoir re-choisir le même fichier.
 */
export function ImagePicker({ value, onChange, multiple = false, max = 8, maxSide = 1200, label }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  // Libère les aperçus à la fermeture du composant.
  useEffect(() => {
    return () => latest.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // permet de re-sélectionner le même fichier
    if (files.length === 0) return;

    const room = multiple ? Math.max(0, max - value.length) : 1;
    if (room === 0) {
      toast.error(`${max} photos maximum.`);
      return;
    }
    if (files.length > room) toast.message(`Seules ${room} photo(s) de plus sont acceptées.`);

    setBusy(true);
    const added: PickedImage[] = [];
    for (const file of files.slice(0, room)) {
      try {
        const { blob, ext } = await compressImage(file, maxSide);
        added.push({ id: crypto.randomUUID(), blob, ext, previewUrl: URL.createObjectURL(blob) });
      } catch (error) {
        toast.error(error instanceof ImageError ? error.message : "Impossible de lire cette photo.");
      }
    }
    setBusy(false);
    if (added.length === 0) return;

    if (multiple) {
      onChange([...value, ...added]);
    } else {
      value.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      onChange(added.slice(0, 1));
    }
  }

  function remove(id: string) {
    const target = value.find((image) => image.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(value.filter((image) => image.id !== id));
  }

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {value.map((image, index) => (
            <li key={image.id} className="relative h-[72px] w-[72px] overflow-hidden rounded-[10px] bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), pas d'optimisation possible */}
              <img src={image.previewUrl} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(image.id)}
                aria-label={`Supprimer la photo ${index + 1}`}
                className="absolute right-0.5 top-0.5 grid h-6 w-6 cursor-pointer place-items-center rounded-full bg-black/65 text-white"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={busy || (multiple && value.length >= max)}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus size={18} aria-hidden="true" />
        {busy ? "Préparation…" : label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handleFiles}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
